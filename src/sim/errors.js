// Lỗi định dạng inputs/scenario → headless thoát với mã 2.
export class FormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormatError';
  }
}
