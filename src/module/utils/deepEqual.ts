/**
 * Returns true if both objects are equal
 * @param obj1 left object
 * @param obj2 right object
 * @returns boolean
 */
export function deepEqual(obj1: any, obj2: any): boolean {
    // If objects are not the same type, return false
    if (typeof obj1 !== typeof obj2) return false;

    // If objects are both null or undefined, return true
    if (obj1 === null || obj2 === null) return obj1 === obj2;

    // If objects are both primitive types, compare them directly
    if (typeof obj1 !== 'object' && typeof obj2 !== 'object') {
        return obj1 === obj2;
    }

    // If objects are arrays, compare their elements recursively
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        if (obj1.length !== obj2.length) return false;
        return obj1.every((item, index) => deepEqual(item, obj2[index]));
    }

    // If one is array and the other is not, return false
    if (Array.isArray(obj1) || Array.isArray(obj2)) return false;

    // If objects are both objects, compare their properties recursively
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
}
