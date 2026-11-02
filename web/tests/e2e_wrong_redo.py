"""错题重做流程端到端验证。

覆盖：
  1. 随机练习里答错一道题 → 进错题本
  2. 科目页出现「错题重做」按钮
  3. 第一次答对 → 连对 1/2，仍在错题本
  4. 本轮结束面板 → 再来一轮
  5. 第二次答对 → 已移出错题本，科目页按钮消失

用法：先起 npm run preview，然后 python tests/e2e_wrong_redo.py
"""
import asyncio
import re
import sys

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:4173/"
SUBJECT = "习近平新时代中国特色社会主义思想"


def letters_of(txt: str, typ: str) -> list[str]:
    if typ == "判断":
        if "正确答案：正确" in txt:
            return ["A"]
        if "正确答案：错误" in txt:
            return ["B"]
    return sorted(set(re.findall(r"(?<![A-Za-z])([A-F])\.", txt)))


async def answer(pg, letters):
    typ = (await pg.locator(".qhead .badge").first.inner_text()).strip()
    for letter in letters:
        await pg.locator(".opt").nth(ord(letter) - 65).click()
    if typ == "多选":
        await pg.get_by_role("button", name=re.compile("确认答案")).first.click()
    await pg.wait_for_selector(".answerbox", timeout=20000)
    await pg.wait_for_function(
        "!document.querySelector('.answerbox').innerText.includes('正在记录')", timeout=15000
    )
    return (await pg.locator(".answerbox").inner_text()).replace("\n", " ")


async def main() -> int:
    errors: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await (await browser.new_context(viewport={"width": 390, "height": 844})).new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        await page.goto(BASE, wait_until="networkidle", timeout=90000)
        await page.locator(".subject-card", has_text=SUBJECT).click()
        await page.wait_for_function("!document.querySelector('.loading')", timeout=120000)

        await page.get_by_text("随机练习", exact=True).click()
        await page.wait_for_selector(".stem")

        letters, typ = None, None
        for _ in range(15):
            typ = (await page.locator(".qhead .badge").first.inner_text()).strip()
            txt = await answer(page, ["A"])
            if "回答错误" in txt:
                letters = letters_of(txt, typ)
                break
            await page.get_by_role("button", name="下一题").click()
            await page.wait_for_timeout(100)
        if not letters:
            print("15 题内没遇到错题，跳过")
            await browser.close()
            return 0
        print(f"错题类型 {typ}，正确答案 {letters}")

        await page.locator(".topbar .iconbtn").first.click()
        await page.wait_for_selector("text=错题重做", timeout=20000)
        await page.get_by_text(re.compile("错题重做（")).click()
        await page.wait_for_selector(".stem", timeout=20000)

        first = await answer(page, letters)
        assert "1/2" in first, first
        print("第一次答对：", first[-30:])

        await page.get_by_role("button", name="下一题").click()
        await page.wait_for_selector("text=本轮结束", timeout=15000)
        await page.get_by_role("button", name=re.compile("再来一轮")).click()
        await page.wait_for_selector(".stem", timeout=20000)
        await page.wait_for_timeout(400)

        second = await answer(page, letters)
        assert "已移出错题本" in second, second
        print("第二次答对：", second[-34:])

        await page.locator(".topbar .iconbtn").first.click()
        await page.wait_for_timeout(800)
        assert "错题重做（" not in await page.locator(".page").inner_text()
        print("科目页错题按钮已消失")
        await browser.close()

    print("控制台错误:", len(errors), errors[:3])
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
