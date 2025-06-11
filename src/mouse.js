export async function simulateMouseMovement(page) {
    const mouse = page.mouse;
    await mouse.move(0, 0);
    await mouse.move(50, 50);
    await mouse.move(100, 100);
}
