import asyncio, json, os, sys
from playwright.async_api import async_playwright

OUT = r"D:/APKnixiang/work/njfu-quiz/web/tests/shots"
os.makedirs(OUT, exist_ok=True)
BASE = "http://127.0.0.1:4173/"

async def main():
    logs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page.on("console", lambda m: logs.append(("console", m.type, m.text)))
        page.on("pageerror", lambda e: logs.append(("pageerror", "error", str(e))))
        page.on("requestfailed", lambda r: logs.append(("requestfailed", "error", f"{r.url} {r.failure}")))

        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_selector(".subject-card", timeout=15000)
        n = await page.locator(".subject-card").count()
        print("科目卡片:", n)
        await page.screenshot(path=f"{OUT}/01-home.png", full_page=True)

        # 进入马原
        await page.locator(".subject-card", has_text="马克思主义基本原理").click()
        await page.wait_for_selector("text=顺序练习", timeout=60000)
        # 等导入完成（loading 消失）
        await page.wait_for_function("!document.querySelector('.loading')", timeout=120000)
        await page.screenshot(path=f"{OUT}/02-subject.png", full_page=True)
        print("科目页 OK")

        await page.get_by_text("顺序练习", exact=True).click()
        await page.wait_for_selector(".stem", timeout=30000)
        await page.screenshot(path=f"{OUT}/03-practice.png", full_page=True)
        stem = await page.locator(".stem").inner_text()
        print("第一题:", stem[:40].replace("\n", " "))

        # 选 A
        await page.locator(".opt").first.click()
        await page.wait_for_selector(".answerbox", timeout=10000)
        box = await page.locator(".answerbox").inner_text()
        print("判分:", box.replace("\n", " ")[:60])
        await page.screenshot(path=f"{OUT}/04-graded.png", full_page=True)

        # 下一题
        await page.get_by_role("button", name="下一题").click()
        await page.wait_for_timeout(400)
        idx_text = await page.locator(".topbar .sub").inner_text()
        print("翻页后:", idx_text)

        # 答题卡
        await page.get_by_role("button", name="答题卡").click()
        await page.wait_for_selector(".jumpgrid")
        await page.screenshot(path=f"{OUT}/05-jump.png", full_page=True)
        await page.get_by_role("button", name="关闭").click()

        # 返回科目 -> 模拟考试
        await page.goto(BASE, wait_until="networkidle")
        await page.locator(".subject-card", has_text="人工智能").click()
        await page.wait_for_selector("text=模拟考试", timeout=60000)
        await page.wait_for_function("!document.querySelector('.loading')", timeout=120000)
        await page.get_by_text("模拟考试", exact=True).click()
        await page.wait_for_selector("text=组卷规则", timeout=30000)
        await page.screenshot(path=f"{OUT}/06-exam-setup.png", full_page=True)
        await page.get_by_text("开始考试", exact=True).click()
        await page.wait_for_selector(".stem", timeout=30000)
        await page.screenshot(path=f"{OUT}/07-exam-run.png", full_page=True)
        timer = await page.locator(".timer").inner_text()
        print("计时器:", timer)

        # 桌面视口
        page2 = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page2.goto(BASE, wait_until="networkidle")
        await page2.wait_for_selector(".subject-card", timeout=15000)
        await page2.screenshot(path=f"{OUT}/08-desktop.png", full_page=True)

        await browser.close()

    errs = [l for l in logs if l[0] in ("pageerror", "requestfailed") or (l[0] == "console" and l[1] == "error")]
    print("\n控制台错误:", len(errs))
    for e in errs[:10]:
        print("  ", e)
    return 0 if not errs else 1

sys.exit(asyncio.run(main()))
