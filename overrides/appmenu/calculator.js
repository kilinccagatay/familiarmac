// Bounded arithmetic parser: never execute search text as JavaScript or a command.
export function calculate(query) {
    const source = query.trim().replace(/=$/, '').replace(/[×]/g, '*')
        .replace(/[÷]/g, '/').replace(/[−]/g, '-').replace(/,/g, '.');
    if (!source || source.length > 256) return null;
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/^%-]/gi);
    if (!tokens || tokens.join('') !== source.replace(/\s/g, '')) return null;
    let pos = 0;
    const take = token => tokens[pos] === token && (++pos, true);
    function primary() {
        let value;
        if (take('(')) {
            value = sum();
            if (!take(')')) throw Error('Incomplete parentheses');
        } else {
            const token = tokens[pos++];
            if (!token || !/^(?:\d|\.)/.test(token)) throw Error('Expected number');
            value = Number(token);
        }
        while (take('%')) value /= 100;
        return value;
    }
    function power() {
        const value = primary();
        return take('^') ? value ** unary() : value;
    }
    function unary() {
        if (take('+')) return unary();
        if (take('-')) return -unary();
        return power();
    }
    function product() {
        let value = unary();
        while (pos < tokens.length) {
            if (take('*')) value *= unary();
            else if (take('/')) value /= unary();
            else break;
        }
        return value;
    }
    function sum() {
        let value = product();
        while (pos < tokens.length) {
            if (take('+')) value += product();
            else if (take('-')) value -= product();
            else break;
        }
        return value;
    }
    try {
        const value = sum();
        if (pos !== tokens.length || !Number.isFinite(value)) return null;
        // Suppress binary floating-point noise without promising arbitrary precision.
        return Object.is(value, -0) ? 0 : Number(value.toPrecision(12));
    } catch (_) { return null; }
}

export function formatCalculation(value, locale) {
    return new Intl.NumberFormat(locale, {maximumSignificantDigits: 12, useGrouping: false}).format(value);
}
