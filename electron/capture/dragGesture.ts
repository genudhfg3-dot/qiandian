export class DragGesture {
  moved = false
  constructor(readonly start: { x: number; y: number }, readonly offset: { x: number; y: number }, readonly threshold = 4) {}
  update(cursor: { x: number; y: number }) {
    this.moved ||= Math.abs(cursor.x - this.start.x) > this.threshold || Math.abs(cursor.y - this.start.y) > this.threshold
    return { x: Math.round(cursor.x - this.offset.x), y: Math.round(cursor.y - this.offset.y) }
  }
}
