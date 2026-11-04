export function fitViewport(tables, bookmarks, width, height) {
    const boxes = [
        ...tables.map(table => ({ x: table.position.x, y: table.position.y, width: table.width || 320, height: table.height || 240 })),
        ...bookmarks,
    ];
    if (!boxes.length) return { zoom: 1, pan: { x: 0, y: 0 } };
    const left = Math.min(...boxes.map(box => box.x));
    const top = Math.min(...boxes.map(box => box.y));
    const right = Math.max(...boxes.map(box => box.x + box.width));
    const bottom = Math.max(...boxes.map(box => box.y + box.height));
    const zoom = Math.max(0.1, Math.min(1, (width - 100) / Math.max(right - left, 1), (height - 130) / Math.max(bottom - top, 1)));
    return { zoom, pan: { x: width / 2 - (left + right) * zoom / 2, y: height / 2 - (top + bottom) * zoom / 2 } };
}

export function canvasPoint(clientX, clientY, rect, pan, zoom) {
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
}
