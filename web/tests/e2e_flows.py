import asyncio, os, sys, time
from playwright.async_api import async_playwright

OUT = r"D:/APKnixiang/work/njfu-quiz/web/tests/shots"
BASE = "http://127.0.0.1:4173/"

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844})
        page = await ctx.new_page()
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        t0 = time.time()
        await page.goto(BASE, wait_until="networkidle")
        await page.locator(".subject-card", has_text="中国近代史纲要").click()
        await page.wait_for_function("!document.querySelector('.loading')", timeout=120000)
        print("首次导入 977 题耗时 %.1fs" % (time.time() - t0))

        await page.get_by_text("随机练习", exact=True).click()
        await page.wait_for_selector(".stem")
        # 连续答 3 题，故意全选 A
        for i in range(3):
            badge = await page.locator(".qhead .badge").inner_text()
            await page.locator(".opt").first.click()
            if badge.strip() == "多选":
                await page.get_by_role("button", name="确认答案（多选，可选多个）").click()
            await page.wait_for_selector(".answerbox", timeout=10000)
            await page.get_by_role("button", name="下一题").click()
            await page.wait_for_timeout(200)
        await page.screenshot(path=f"{OUT}/09-after3.png", full_page=True)

        # 回首页看统计
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_selector(".subject-card")
        stats = await page.locator(".stat").all_inner_texts()
        print("首页统计:", [s.replace("\n", " ") for s in stats])
        await page.screenshot(path=f"{OUT}/10-home-after.png", full_page=True)

        # 错题本
        await page.locator(".subject-card", has_text="中国近代史纲要").click()
        await page.wait_for_function("!document.querySelector('.loading')", timeout=60000)
        await page.get_by_role("button", name="错题本").click()
        await page.wait_for_selector("text=错题本", timeout=10000)
        await page.wait_for_timeout(500)
        txt = await page.locator(".page").inner_text()
        print("错题本片段:", txt[:120].replace("\n", " | "))
        await page.screenshot(path=f"{OUT}/11-wrong.png", full_page=True)

        # 刷新后进度仍在（同一 context 的 IndexedDB 持久）
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_selector(".subject-card")
        txt2 = await page.locator(".subject-card", has_text="中国近代史纲要").inner_text()
        print("刷新后科目卡:", txt2.replace("\n", " | "))

        # 统计页
        await page.get_by_role("button", name="统计").click()
        await page.wait_for_selector("text=学习统计")
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/12-stats.png", full_page=True)

        # 深色模式
        await page.goto(BASE, wait_until="networkidle")
        await page.get_by_role("button", name="设置").click()
        await page.get_by_role("button", name="深色").click()
        await page.wait_for_timeout(400)
        await page.screenshot(path=f"{OUT}/13-dark-settings.png", full_page=True)
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_selector(".subject-card")
        await page.screenshot(path=f"{OUT}/14-dark-home.png", full_page=True)

        await b.close()
    print("\n错误:", len(errs))
    for e in errs[:5]:
        print("  ", e)
    return 0 if not errs else 1

sys.exit(asyncio.run(main()))
