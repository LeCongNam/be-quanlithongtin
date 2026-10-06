// Mọi khóa chính là BIGINT nên Prisma trả BigInt; JSON.stringify không tuần tự hóa được BigInt.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON() {
  return this.toString();
};

export {};
