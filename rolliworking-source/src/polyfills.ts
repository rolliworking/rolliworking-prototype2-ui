// Polyfills for older browsers (iOS 12 Safari, etc.)

// Object.fromEntries polyfill (not in iOS 12)
if (!Object.fromEntries) {
  Object.fromEntries = function <T = any>(entries: Iterable<readonly [PropertyKey, T]>): { [k: string]: T } {
    const obj: { [k: string]: T } = {};
    for (const [key, value] of entries) {
      obj[key as string] = value;
    }
    return obj;
  };
}

// Array.prototype.flat polyfill (not in iOS 12)
if (!Array.prototype.flat) {
  Array.prototype.flat = function<A, D extends number = 1>(this: A, depth?: D): FlatArray<A, D>[] {
    const flatten = (arr: any[], d: number): any[] => {
      return d > 0
        ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val, d - 1) : val), [])
        : arr.slice();
    };
    return flatten(this as any, depth === undefined ? 1 : depth);
  };
}

// Array.prototype.flatMap polyfill (not in iOS 12)
if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function<U, This = undefined>(
    callback: (this: This, value: any, index: number, array: any[]) => U | ReadonlyArray<U>,
    thisArg?: This
  ): U[] {
    return this.map(callback, thisArg).flat(1) as U[];
  };
}

// String.prototype.replaceAll polyfill (not in iOS 12/13)
if (!(String.prototype as any).replaceAll) {
  (String.prototype as any).replaceAll = function(search: string | RegExp, replacement: string): string {
    if (search instanceof RegExp) {
      if (!search.global) {
        throw new TypeError('replaceAll must be called with a global RegExp');
      }
      return this.replace(search, replacement);
    }
    return this.split(search).join(replacement);
  };
}

// globalThis polyfill (not in iOS 12)
(function() {
  if (typeof globalThis === 'undefined') {
    Object.defineProperty(Object.prototype, '__magic__', {
      get: function() {
        return this;
      },
      configurable: true
    });
    // @ts-ignore
    __magic__.globalThis = __magic__;
    // @ts-ignore
    delete Object.prototype.__magic__;
  }
})();

// crypto.randomUUID (used across the app for client-side IDs)
(() => {
  const g: any = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
  const cryptoObj: any = g.crypto || g.msCrypto;
  if (!cryptoObj) return;

  if (typeof cryptoObj.randomUUID === "function") return;

  cryptoObj.randomUUID = function randomUUID() {
    const buf = new Uint8Array(16);

    if (typeof cryptoObj.getRandomValues === "function") {
      cryptoObj.getRandomValues(buf);
    } else {
      for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
    }

    // RFC4122 version 4
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;

    const hex = Array.prototype.map
      .call(buf, (b: number) => ("00" + b.toString(16)).slice(-2))
      .join("");

    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  };
})();

// Promise.allSettled polyfill (not in iOS 12)
if (!Promise.allSettled) {
  Promise.allSettled = function<T extends readonly unknown[] | []>(promises: T): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }> {
    return Promise.all(
      Array.from(promises).map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason })
        )
      )
    ) as any;
  };
}
