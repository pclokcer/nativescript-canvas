import { Font } from '@nativescript/core/ui/styling/font';
import { layout, Color, View } from '@nativescript/core/ui/core/view';
import { screen } from '@nativescript/core/platform';
import { ImageSource } from '@nativescript/core/image-source/image-source';
import { Canvas as ICanvas, Paint as IPaint, Matrix as IMatrix, Path as IPath, Rect as IRect, RectF as IRectF, FontMetrics as IFontMetrics } from './canvas';
import { CanvasBase, DEFAULT_SCALE } from './canvas.common';
import { profile } from '@nativescript/core/profiling/profiling';

export * from './canvas.common';

const identity = CGAffineTransformIdentity;

function DEGREES_TO_RADIANS(x) {
    return (Math.PI * x) / 180.0;
}
function CGAffineTransformMakeSkew(sx, sy) {
    return CGAffineTransformMake(1, DEGREES_TO_RADIANS(sx), DEGREES_TO_RADIANS(sy), 1, 0, 0);
}
const FloatConstructor = interop.sizeof(interop.types.id) === 4 ? Float32Array : Float64Array;

// const enum MemberType {
//     Static,
//     Instance
// }

// function timelineProfileFunctionFactory<F extends Function>(fn: F, name: string, type: MemberType = MemberType.Instance): F {
//     let result;
//     if (type === MemberType.Instance) {
//         result = function() {
//             // const start = time();
//             console.log(name);
//             try {
//                 return fn.apply(this, arguments);
//             } finally {
//                 // const end = time();
//                 // console.log(`Timeline: Modules: ${name} ${this}  (${start}ms. - ${end}ms.)`);
//             }
//         };
//     } else {
//         result = function() {
//             // const start = time();
//             // console.log(`calling method: ${name}`);
//             try {
//                 return fn.apply(this, arguments);
//             } finally {
//                 // const end = time();
//                 // console.log(`Timeline: Modules: ${name}  (${start}ms. - ${end}ms.)`);
//             }
//         };
//     }
//     return result;
// }
// function profile(target?: string | Function | Object, key?, descriptor?: PropertyDescriptor): any {
//     // save a reference to the original method this way we keep the values currently in the
//     // descriptor and don't overwrite what another decorator might have done to the descriptor.
//     if (descriptor === undefined) {
//         descriptor = Object.getOwnPropertyDescriptor(target, key);
//     }
//     const originalMethod = descriptor.value;

//     let className = '';
//     if (target && target.constructor && target.constructor.name) {
//         className = target.constructor.name + '.';
//     }

//     const name = className + key;

//     // editing the descriptor/value parameter
//     descriptor.value = timelineProfileFunctionFactory(originalMethod, name, MemberType.Instance);

//     // return edited descriptor as opposed to overwriting the descriptor
//     return descriptor;
// }

function paint(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value as Function; // save a reference to the original method

    // NOTE: Do not use arrow syntax here. Use a function expression in
    // order to use the correct value of `this` in this method (see notes below)
    descriptor.value = function(...args: any[]) {
        let index = args.length - 1;
        let paint = args[index];
        let actualPaint;
        if (paint instanceof Paint) {
            actualPaint = this.startApplyPaint(paint, true);
            args[index] = actualPaint;
        } else {
            index = args.length - 2;
            paint = args[index];
            if (paint instanceof Paint) {
                actualPaint = this.startApplyPaint(paint, true);
                args[index] = actualPaint;
            } else {
                actualPaint = this.startApplyPaint();
            }
        }
        const result = originalMethod.apply(this, args);
        this.finishApplyPaint(actualPaint);
        return result;
    };

    return descriptor;
}

export enum Style {
    FILL,
    STROKE,
    FILL_AND_STROKE
}
export enum Cap {
    ROUND = CGLineCap.kCGLineCapRound,
    SQUARE = CGLineCap.kCGLineCapSquare,
    BUT = CGLineCap.kCGLineCapButt
}

export enum Join {
    BEVEL = CGLineJoin.kCGLineJoinBevel,
    MITER = CGLineJoin.kCGLineJoinMiter,
    ROUND = CGLineJoin.kCGLineJoinRound
}
export enum Align {
    LEFT = 0,
    RIGHT = 1,
    CENTER = 2
}

export enum Direction {
    CCW,
    CW
}
export enum TileMode {
    CLAMP,
    MIRROR,
    REPEAT
}
export enum FillType {
    EVEN_ODD,
    INVERSE_EVEN_ODD,
    INVERSE_WINDING,
    WINDING
}

export enum Op {
    DIFFERENCE,
    INTERSECT,
    REPLACE,
    REVERSE_DIFFERENCE,
    UNION,
    XOR
}

function createCGRect(l, t, r, b) {
    return CGRectMake(l, t, r - l, b - t);
}

export class Rect implements IRect {
    get cgRect() {
        return this._rect;
    }
    set cgRect(rect: CGRect) {
        this._rect = rect;
        this.left = this._rect.origin.x;
        this.top = this._rect.origin.y;
        this.right = this.left + this._rect.size.width;
        this.bottom = this.top + this._rect.size.height;
    }

    // public set(rect: Rect) {
    //     this.cgRect = rect.cgRect;
    // }
    public set(...args) {
        if (args.length === 1) {
            if (args[0] instanceof Rect) {
                this.cgRect = args[0].cgRect;
            } else {
                this.cgRect = args[0];
            }
        } else {
            // const l = (this.left = args[0]);
            // const t = (this.top = args[1]);
            // const r = (this.right = args[2]);
            // const b = (this.bottom = args[3]);
            this.cgRect = createCGRect(args[0], args[1], args[2], args[3]);
        }
    }
    public inset(dx: number, dy: number): void {
        this.cgRect = CGRectInset(this.cgRect, dx, dy);
    }
    public union(...params): void {
        // this.cgRect = CGRectOffset(this.cgRect, dx, dy);
        console.error('Method not implemented:', 'union');
    }
    public offsetTo(x: number, y: number): void {
        this.cgRect = CGRectMake(x, y, this._rect.size.width, this._rect.size.height);
    }
    public offset(dx: number, dy: number): void {
        this.cgRect = CGRectOffset(this.cgRect, dx, dy);
    }
    public centerX(): number {
        return this.cgRect.origin.x + this.cgRect.size.width / 2;
    }
    public centerY(): number {
        return this.cgRect.origin.y + this.cgRect.size.height / 2;
    }
    public intersect(...args) {
        const length = args.length;
        let rect: CGRect;
        if (length === 4) {
            rect = createCGRect(args[0], args[1], args[2], args[3]);
        } else if (length === 1) {
            rect = (args[0] as Rect).cgRect;
        }
        const result = CGRectIntersection(this.cgRect, rect);
        if (!CGRectIsNull(result)) {
            this.cgRect = result;
            return true;
        }
        return false;
    }
    public contains(...args) {
        const length = args.length;
        let rect: CGRect;
        if (length === 4) {
            rect = createCGRect(args[0], args[1], args[2], args[3]);
        } else if (length === 1) {
            rect = (args[0] as Rect).cgRect;
        }
        return CGRectContainsRect(this.cgRect, rect);
    }
    _rect: CGRect;
    left: number;
    top: number;
    right: number;
    bottom: number;
    constructor(...args) {
        this.set.apply(this, args);
    }

    toString() {
        return `Rect(${this.left},${this.top},${this.right},${this.bottom})`;
    }
    // constructor(rect: CGRect) {
    //     this._rect = rect;
    // }

    width() {
        return this._rect.size.width;
    }
    height() {
        return this._rect.size.height;
    }
}
export class RectF extends Rect {}

export class Matrix implements IMatrix {
    _transform: CGAffineTransform;
    constructor() {
        this._transform = CGAffineTransformIdentity;
        // this._path = UIBezierPath.bezierPath();
    }
    mapRect(rect: Rect) {
        const cgRect = CGRectApplyAffineTransform(rect.cgRect, this._transform);
        return new Rect(cgRect);
    }
    // public setRotate(param0: number, param1: number, param2: number): void;
    // public setRotate(param0: number): void;
    public setRotate(degrees: number, px: number = 0, py: number = 0) {
        this._transform = CGAffineTransformMakeRotation(DEGREES_TO_RADIANS(degrees));
        if (px !== 0 || py !== 0) {
            this.postConcat(CGAffineTransformMakeTranslation(px, py));
            this.preConcat(CGAffineTransformMakeTranslation(-px, -py));
        }
    }

    static MSCALE_X = 0;
    static MSKEW_X = 1;
    static MTRANS_X = 2;
    static MSKEW_Y = 3;
    static MSCALE_Y = 4;
    static MTRANS_Y = 5;
    static MPERSP_0 = 6;
    static MPERSP_1 = 7;
    static MPERSP_2 = 8;
    public getValues(param: number[]): void {
        if (param) {
            param[0] = this._transform.a;
            param[1] = this._transform.c;
            param[2] = this._transform.tx;
            param[3] = this._transform.b;
            param[4] = this._transform.d;
            param[5] = this._transform.ty;
            param[6] = 0;
            param[7] = 0;
            param[8] = 1;
        }
    }
    // public setScale(param0: number, param1: number): void;
    // public setScale(param0: number, param1: number, param2: number, param3: number): void;
    public setScale(sx: number, sy: number, px: number = 0, py: number = 0) {
        this._transform = CGAffineTransformMakeScale(sx, sy);
        if (px !== 0 || py !== 0) {
            this.postConcat(CGAffineTransformMakeTranslation(px, py));
            this.preConcat(CGAffineTransformMakeTranslation(-px, -py));
        }
    }
    // public preScale(param0: number, param1: number, param2: number, param3: number): boolean;
    // public preScale(param0: number, param1: number): boolean;
    public preScale(sx: number, sy: number, px?: number, py?: number): boolean {
        const mat = new Matrix();
        mat.setScale(sy, sy, px, py);
        return this.preConcat(mat);
    }
    public setConcat(mat1: IMatrix, mat2: IMatrix): boolean {
        this._transform = CGAffineTransformConcat((mat1 as Matrix)._transform, (mat2 as Matrix)._transform);
        return true;
    }
    // public postSkew(param0: number, param1: number): boolean;
    // public postSkew(param0: number, param1: number, param2: number, param3: number): boolean;
    public postSkew(sx: number, sy: number, px?: number, py?: number) {
        const mat = new Matrix();
        mat.setSkew(sy, sy, px, py);
        return this.postConcat(mat);
    }

    // postConcat(mat1: CGAffineTransform, mat2: CGAffineTransform) {
    // return CGAffineTransformConcat(mat1, mat2);
    // }
    // public postScale(param0: number, param1: number): boolean;
    // public postScale(param0: number, param1: number, param2: number, param3: number): boolean;
    public postScale(sx: number, sy: number, px?: number, py?: number) {
        const mat = new Matrix();
        mat.setScale(sx, sy, px, py);
        return this.postConcat(mat);
        // this._transform = CGAffineTransformConcat(this._transform, mat._transform);
        // return true;
    }
    // public preSkew(param0: number, param1: number, param2: number, param3: number): boolean;
    // public preSkew(param0: number, param1: number): boolean;
    public preSkew(sx: number, sy: number, px?: number, py?: number) {
        const mat = new Matrix();
        mat.setSkew(sy, sy, px, py);
        return this.preConcat(mat);
    }
    // public mapPoints(param0: native.Array<number>, param1: native.Array<number>): void;
    // public mapPoints(param0: native.Array<number>, param1: number, param2: native.Array<number>, param3: number, param4: number): void;
    // public mapPoints(param0: native.Array<number>): void;
    public mapPoints(...args) {
        let src: number[];
        let dstIndex: number,
            srcIndex: number = 0,
            pointCount: number;
        const pts: number[] = args[0];
        if (args.length === 2) {
            src = args[1];
        } else {
            dstIndex = args[1] || 0;
            srcIndex = args[3] || 0;
            pointCount = args[4];
            src = args[2];
        }
        src = src || pts;
        pointCount = Math.floor(pointCount || src.length);
        // console.log('mapPoints', src, pointCount, srcIndex, dstIndex);
        for (let index = 0; index < pointCount; index += 2) {
            const cgPoint = CGPointApplyAffineTransform(CGPointMake(src[index + srcIndex], src[index + srcIndex + 1]), this._transform);
            // console.log('mapPoint', src[2*index + srcIndex], src[2*index + srcIndex + 1], cgPoint.x, cgPoint.y);
            pts[index + dstIndex] = cgPoint.x;
            pts[index + dstIndex + 1] = cgPoint.y;
        }
    }
    // public mapVectors(param0: native.Array<number>, param1: native.Array<number>): void;
    // public mapVectors(param0: native.Array<number>): void;
    // public mapVectors(param0: native.Array<number>, param1: number, param2: native.Array<number>, param3: number, param4: number): void;
    public mapVectors(...args) {
        this.mapPoints.apply(this, args);
    }
    public setPolyToPoly(param0: number[], param1: number, param2: number[], param3: number, param4: number): boolean {
        console.error('Method not implemented:', 'setPolyToPoly');
        return false;
    }
    // public postRotate(param0: number, param1: number, param2: number): boolean;
    // public postRotate(param0: number): boolean;
    public postRotate(degrees: number, px?: number, py?: number) {
        const mat = new Matrix();
        mat.setRotate(degrees, px, py);
        return this.postConcat(mat);
    }
    public mapRadius(param0: number): number {
        console.error('Method not implemented:', 'mapRadius');
        return -1;
    }
    public set(mat: IMatrix): void {
        this._transform = CGAffineTransformConcat(CGAffineTransformIdentity, (mat as Matrix)._transform);
    }
    // public preRotate(param0: number): boolean;
    // public preRotate(param0: number, param1: number, param2: number): boolean;
    public preRotate(degrees: number, px?: number, py?: number) {
        const mat = new Matrix();
        mat.setRotate(degrees, px, py);
        return this.preConcat(mat);
    }
    public postTranslate(tx: number, ty: number): boolean {
        return this.postConcat(CGAffineTransformMakeTranslation(tx, ty));
        // this._transform = CGAffineTransformConcat(this._transform, CGAffineTransformMakeTranslation(tx, ty));
    }
    // public setSinCos(param0: number, param1: number, param2: number, param3: number): void;
    // public setSinCos(param0: number, param1: number): void;
    public setSinCos(sin: number, cos: number, px = 0, py = 0) {
        this._transform = CGAffineTransformIdentity;
        // const oneMinusCos = 1-cos;
        this._transform.a = cos;
        this._transform.b = -sin;
        // this._transform.transX = sdot(sin, pivoty, oneMinusCos, pivotx);
        this._transform.c = sin;
        this._transform.d = cos;
        // this._transform.transY = sdot(-sin, pivotx, oneMinusCos, pivoty);
        if (px !== 0 || py !== 0) {
            this.postConcat(CGAffineTransformMakeTranslation(px, py));
            this.preConcat(CGAffineTransformMakeTranslation(-px, -py));
        }
    }
    public rectStaysRect(): boolean {
        console.error('Method not implemented:', 'rectStaysRect');
        return false;
    }
    public equals(mat: IMatrix): boolean {
        return CGAffineTransformEqualToTransform(this._transform, (mat as Matrix)._transform);
    }
    public isAffine(): boolean {
        return true;
    }
    // public setSkew(param0: number, param1: number): void;
    // public setSkew(param0: number, param1: number, param2: number, param3: number): void;
    public setSkew(sx: number, sy: number, px: number = 0, py: number = 0) {
        this._transform = CGAffineTransformMakeSkew(sx, sy);
        if (px !== 0 || py !== 0) {
            this.postConcat(CGAffineTransformMakeTranslation(px, py));
            this.preConcat(CGAffineTransformMakeTranslation(-px, -py));
        }
    }
    public reset(): void {
        this._transform = CGAffineTransformIdentity;
    }
    public toShortString(): string {
        return [
            [this._transform.a, this._transform.c, this._transform.tx],
            [this._transform.b, this._transform.d, this._transform.ty],
            [0, 0, 1]
        ].toString();
    }
    public setTranslate(tx: number, ty: number): void {
        this._transform = CGAffineTransformMakeTranslation(tx, ty);
    }
    public postConcat(mat: IMatrix | CGAffineTransform): boolean {
        this._transform = CGAffineTransformConcat(this._transform, (mat as Matrix)._transform || (mat as CGAffineTransform));
        return true;
    }

    public preConcat(mat: IMatrix | CGAffineTransform): boolean {
        this._transform = CGAffineTransformConcat((mat as Matrix)._transform || (mat as CGAffineTransform), this._transform);
        return true;
    }
    public setRectToRect(param0: IRectF, param1: IRectF, param2: any): boolean {
        console.error('Method not implemented:', 'centsetRectToRecterY');
        return false;
    }
    public isIdentity(): boolean {
        return CGAffineTransformIsIdentity(this._transform);
    }
    public toString(): string {
        return NSStringFromCGAffineTransform(this._transform);
    }
    public preTranslate(tx: number, ty: number): boolean {
        return this.preConcat(CGAffineTransformMakeTranslation(tx, ty));
    }
    public setValues(values: number[]): void {
        this._transform = CGAffineTransformMake(values[0], values[3], values[1], values[4], values[2], values[5]);
        // this._transform.a = values[0];
        // this._transform.c = values[1];
        // this._transform.tx = values[2];
        // this._transform.b = values[3];
        // this._transform.d = values[4];
        // this._transform.ty = values[5];
    }
    public invert(output: IMatrix): boolean {
        (output as Matrix)._transform = CGAffineTransformInvert(this._transform);
        return !this.equals(output);
    }
    public hashCode(): number {
        console.error('Method not implemented:', 'hashCode');
        return -1;
    }
    public wait(...args) {
        console.error('Method not implemented:', 'wait');
    }
    public clone(...args) {
        console.error('Method not implemented:', 'clone');
    }
    public notify(...args): void {
        console.error('Method not implemented:', 'notify');
    }
    public getClass(...args): any {
        console.error('Method not implemented:', 'getClass');
    }
    public finalize(): void {
        console.error('Method not implemented:', 'finalize');
    }
    public notifyAll(): void {
        console.error('Method not implemented:', 'notifyAll');
    }
}

export class PathEffect {}
export class DashPathEffect extends PathEffect {
    constructor(public intervals: number[], public phase: number) {
        super();
    }
}

export class Path implements IPath {
    private _path: any;
    private _bPath?: UIBezierPath;
    _fillType: FillType;

    getOrCreateBPath() {
        if (!this._bPath) {
            if (this._path) {
                this._bPath = UIBezierPath.bezierPathWithCGPath(this._path);
            } else {
                this._bPath = UIBezierPath.bezierPath();
            }
        }
        return this._bPath;
    }
    getCGPath() {
        if (this._bPath) {
            return this._bPath.CGPath;
        }
        return this._path;
    }
    getBPath() {
        if (this._bPath) {
            return this._bPath;
        }
        return undefined;
    }
    setBPath(bPath: UIBezierPath) {
        this._bPath = bPath;
        // this._path = this._bPath.CGPath;
    }
    constructor() {
        this._path = CGPathCreateMutable();
        // this._path = UIBezierPath.bezierPath();
    }
    computeBounds(rect: RectF, exact: boolean) {
        if (this._bPath) {
            rect.cgRect = this._bPath.bounds;
        } else {
            rect.cgRect = CGPathGetBoundingBox(this._path);
        }
        console.log(rect.toString());
    }

    isRect(rect: Rect): boolean {
        return CGPathIsRect(this.getCGPath(), new interop.Reference(rect.cgRect));
    }
    getCurrentPoint() {
        const path = this.getCGPath();
        if (CGPathIsEmpty(path)) {
            this.moveTo(0, 0);
        }
        return CGPathGetCurrentPoint(this.getCGPath());
    }
    rMoveTo(dx: number, dy: number): void {
        const currentPoint = this.getCurrentPoint();
        this.moveTo(dx + currentPoint.x, dy + currentPoint.y);
    }
    @profile
    addLines(points: number[], length?: number, close?: boolean) {
        // const pts = args[0] as number[];
        if (points.length <= 0 || points.length % 2 !== 0) {
            console.error('wrong points number');
        }
        // let starttime = Date.now();
        // let count = length || points.length;
        // CGPathMoveToPoint(this._path, null, points[0], points[1]);
        // // console.log('addLines', count);
        // for (let index = 2; index < count; index += 2) {
        //     CGPathAddLineToPoint(this._path, null, points[index], points[index + 1]);
        // }
        // if (close === true) {
        //     CGPathCloseSubpath(this._path);
        // }

        // console.log('test1', Date.now() - starttime);
        // const path = CGPathCreateMutable();
        // starttime = Date.now();
        UIBezierPath.addLinesCountCloseToPath(points, length, close, this._path);
        // console.log('test2', Date.now() - starttime);

        // const bPath =  UIBezierPath.bezierPath();
        // starttime = Date.now();
        // bPath.addLinesCountClose(points, length, close);
        // console.log('test3', Date.now() - starttime);
    }
    setLines(points: number[], length?: number, close?: boolean) {
        this.reset();
        this.addLines(points, length, close);
    }
    addCubicLines(points: number[], length?: number, close?: boolean) {
        // const pts = args[0] as number[];
        if (points.length < 8) {
            console.error('wrong points number');
        }

        // let starttime = Date.now();
        // let count = length || points.length;
        // CGPathMoveToPoint(this._path, null, points[0], points[1]);
        // for (let i = 2; i < count; i += 6) {
        //     CGPathAddCurveToPoint(this._path, null, points[i], points[i + 1], points[i + 2], points[i + 3], points[i + 4], points[i + 5]);
        // }
        // if (close === true) {
        //     CGPathCloseSubpath(this._path);
        // }
        UIBezierPath.addCubicLinesCountCloseToPath(points, length, close, this._path);
    }
    setCubicLines(points: number[], length?: number, close?: boolean) {
        this.reset();
        this.addCubicLines(points, length, close);
    }
    arcTo(rect: Rect, startAngle: number, sweepAngle: number, forceMoveTo?: boolean) {
        const center = CGPointMake(rect.centerX(), rect.centerY());
        if (this._bPath) {
            this._bPath.addArcWithCenterRadiusStartAngleEndAngleClockwise(center, rect.width() / 2, (startAngle * Math.PI) / 180, ((startAngle + sweepAngle) * Math.PI) / 180, true);
        } else {
            let t = CGAffineTransformMakeTranslation(center.x, center.y);
            t = CGAffineTransformConcat(CGAffineTransformMakeScale(1.0, rect.height() / rect.width()), t);
            CGPathAddArc(this._path, new interop.Reference(t), 0, 0, rect.width() / 2, (startAngle * Math.PI) / 180, ((startAngle + sweepAngle) * Math.PI) / 180, true);
        }
    }
    offset(dx: number, dy: number, output?: Path) {
        const t = CGAffineTransformMakeTranslation(dx, dy);
        // if (this._bPath) {
        // this._bPath.bez
        if (this._bPath) {
            if (output) {
                output._bPath = UIBezierPath.bezierPathWithCGPath(this.getCGPath());
                output._bPath.applyTransform(t);
            } else {
                this._bPath.applyTransform(t);
            }
        } else {
            (output || this)._path = CGPathCreateMutableCopyByTransformingPath(this._path, new interop.Reference(t));
        }
    }
    rCubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        const currentPoint = this.getCurrentPoint();
        const x = currentPoint.x;
        const y = currentPoint.y;
        this.cubicTo(x1 + x, y1 + y, x2 + x, y2 + y, x3 + x, y3 + y);
    }
    rQuadTo(cpx: number, cpy: number, x: number, y: number): void {
        const currentPoint = this.getCurrentPoint();
        const dx = currentPoint.x;
        const dy = currentPoint.y;
        this.quadTo(cpx + dx, cpy + dy, x + dx, y + dy);
    }
    addRoundRect(...params) {
        // TODO: direction is ignored!
        const length = params.length;
        let rect: CGRect;
        let rx, ry;
        if (length === 7) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
            rx = params[4];
            ry = params[5];
        } else if (length === 4) {
            rect = (params[0] as Rect).cgRect;
            rx = params[1];
            ry = params[2];
        }
        if (this._bPath) {
            this._bPath.appendPath(UIBezierPath.bezierPathWithRoundedRectByRoundingCornersCornerRadii(rect, UIRectCorner.AllCorners, CGSizeMake(rx, ry)));
        } else {
            CGPathAddRoundedRect(this._path, null, rect, rx, ry);
        }
    }
    addPath(...params) {
        const length = params.length;
        const path = params[0] as Path;
        if (length === 1) {
            if (this._bPath) {
                this._bPath.appendPath(path.getBPath());
            } else {
                CGPathAddPath(this._path, null, path._path);
            }
            // param0: IPath, param1: number, param2: number
        } else if (length === 2) {
            const mat = params[1] as Matrix;
            if (this._bPath) {
                this._bPath.appendPath(path.getBPath());
            } else {
                CGPathAddPath(this._path, new interop.Reference(mat._transform), path._path);
            }
            // param0: IPath, param1: number, param2: number
        } else if (length === 3) {
            if (this._bPath) {
            } else {
                const t = CGAffineTransformMakeTranslation(params[1], params[2]);
                CGPathAddPath(this._path, new interop.Reference(t), path._path);
            }
            // param0: IPath, param1: Matrix
        }
    }
    rLineTo(param0: number, param1: number): void {
        console.error('Method not implemented:', 'rLineTo');
    }
    lineTo(x: number, y: number): void {
        CGPathAddLineToPoint(this._path, null, x, y);
    }
    quadTo(cpx: number, cpy: number, x: number, y: number): void {
        CGPathAddQuadCurveToPoint(this._path, null, cpx, cpy, x, y);
    }
    transform(mat: Matrix, output?: Path) {
        const path = CGPathCreateCopyByTransformingPath(this._path, new interop.Reference(mat._transform));
        if (output) {
            output._path = path;
        } else {
            this._path = path;
        }
    }
    reset(): void {
        if (this._bPath) {
            this._bPath.removeAllPoints();
        } else {
            this._path = CGPathCreateMutable();
        }
    }
    addArc(...params): void {
        const length = params.length;
        const path = params[0];
        let rect: CGRect, sweepAngle, startAngle;
        if (length === 6) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
            // rect = new Rect(params[0], params[1], params[2], params[3]);
            startAngle = params[4];
            sweepAngle = params[5];
        } else if (length === 3) {
            rect = (params[0] as Rect).cgRect;
            startAngle = params[1];
            sweepAngle = params[2];
        }
        const w = rect.size.width;
        const h = rect.size.height;
        const cx = rect.origin.x + w * 0.5;
        const cy = rect.origin.y + h * 0.5;
        const r = rect.size.width * 0.5;
        // const center = CGPointMake(rect.centerX(), rect.centerY());
        let t = CGAffineTransformMakeTranslation(cx, cy);
        t = CGAffineTransformConcat(CGAffineTransformMakeScale(1.0, h / w), t);
        CGPathAddArc(this._path, new interop.Reference(t), 0, 0, r, (startAngle * Math.PI) / 180, ((startAngle + sweepAngle) * Math.PI) / 180, false);
        // CGPathMoveToPoint(this._path, null, center.x, center.y);
    }
    close(): void {
        // CGPathCloseSubpath(this._path);
    }
    addCircle(x: number, y: number, r: number, d: Direction): void {
        CGPathAddEllipseInRect(this._path, null, CGRectMake(x - r, y - r, 2 * r, 2 * r));
    }
    rewind(): void {
        this.reset();
    }
    setLastPoint(param0: number, param1: number): void {
        console.error('Method not implemented:', 'setLastPoint');
    }
    toggleInverseFillType(): void {
        console.error('Method not implemented:', 'toggleInverseFillType');
    }
    moveTo(x: number, y: number): void {
        CGPathMoveToPoint(this._path, null, x, y);
    }
    setFillType(value: FillType): void {
        this._fillType = value;
    }
    isEmpty(): boolean {
        console.error('Method not implemented:', 'isEmpty');
        return false;
    }
    cubicTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
        CGPathAddCurveToPoint(this._path, null, cp1x, cp1y, cp2x, cp2y, x, y);
    }
    incReserve(param0: number): void {
        console.error('Method not implemented:', 'incReserve');
    }
    getFillType(): FillType {
        return this._fillType;
    }
    addRect(...params) {
        const length = params.length;
        let rect: CGRect;
        if (length === 5) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
        } else if (length === 2) {
            rect = (params[0] as Rect).cgRect;
        }
        CGPathAddRect(this._path, null, rect);
    }
    addOval(...params): void {
        const length = params.length;
        let rect: CGRect;
        if (length === 5) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
        } else if (length === 2) {
            rect = (params[0] as Rect).cgRect;
        }
        CGPathAddEllipseInRect(this._path, null, rect);
    }
    isInverseFillType(): boolean {
        return false;
    }
    set(path: Path): void {
        this._path = CGPathCreateMutableCopy(path._path);
    }
}

export class FontMetrics implements IFontMetrics {
    ascent: number;
    descent: number;
    bottom: number;
    leading: number;
    top: number;
}

export class Paint implements IPaint {
    getTextPath(text: string, start: number, end: number, x: number, y: number, path: Path) {
        const bPath = UIBezierPath.fromStringWithFont(text.slice(start, end), this.getUIFont());
        const bounds = bPath.bounds;
        bPath.applyTransform(CGAffineTransformMakeTranslation(bounds.size.width, -bounds.size.height));
        if (x !== 0 || y !== 0) {
            bPath.applyTransform(CGAffineTransformMakeTranslation(x, y));
        }
        path.setBPath(bPath);
        // path._path = bPath.CGPath;
    }
    public setFilterBitmap(param0: boolean) {}
    public setTypeface(font: Font | UIFont): Font {
        if (font instanceof Font) {
            this._font = font;
        } else if (font) {
            this._font['_uiFont'] = font as UIFont;
        } else {
            this._font = null;
        }
        this._textAttribs = null;
        return this._font;
    }
    public setTextAlign(align: Align): void {
        this.align = align;
        this._textAttribs = null;
    }
    public getTextAlign(): Align {
        return this.align;
    }
    _color: Color = new Color('black');
    style: Style = Style.FILL;
    align: Align = Align.LEFT;
    // _textSize = 16;
    _font: Font;
    strokeWidth = 0;
    strokeMiter = 0;
    strokeCap: Cap = Cap.BUT;
    strokeJoin: Join = Join.BEVEL;
    antiAlias = false;
    dither = false;
    alpha = 1;
    currentContext: any;
    shadowLayer?: {
        radius: number;
        dx: number;
        dy: number;
        color: Color;
    };
    shader;

    public setShadowLayer(radius: number, dx: number, dy: number, color: number | Color | string): void {
        color = color instanceof Color ? color : new Color(color as any);
        this.shadowLayer = {
            radius: radius / 1,
            dx,
            dy,
            color: new Color(color.a / 1, color.r, color.g, color.b)
        };
    }
    public clearShadowLayer() {
        this.shadowLayer = undefined;
    }

    public getAlpha(): number {
        return this.alpha;
    }
    public getStyle(): Style {
        return this.style;
    }
    public setStrokeMiter(value: number): void {
        this.strokeMiter = value;
    }
    public setARGB(a: number, r: number, g: number, b: number): void {
        this._color = new Color(a, r, g, b);
    }
    public measureText(text: string, start = 0, end?) {
        if (end === undefined) {
            end = text.length;
        }
        const result = NSString.stringWithString(text.slice(start, end)).sizeWithFont(this.getUIFont());
        return result.width;
    }
    public getTextBounds(text: string, start: number, end: number, rect: Rect): void {
        const cgrect = NSString.stringWithString(text.slice(start, end)).boundingRectWithSizeOptionsAttributesContext(
            CGSizeMake(Number.MAX_VALUE, Number.MAX_VALUE),
            NSStringDrawingOptions.UsesDeviceMetrics,
            this.getDrawTextAttribs(),
            null
        );
        rect.cgRect = CGRectMake(0, -cgrect.size.height, cgrect.size.width, cgrect.size.height);
    }
    public isAntiAlias(): boolean {
        return this.antiAlias;
    }
    public setStrokeJoin(value: Join): void {
        this.strokeJoin = value;
    }
    public getStrokeJoin(): Join {
        return this.strokeJoin;
    }
    public getShader() {
        return this.shader;
    }
    public setStrokeWidth(value: number): void {
        this.strokeWidth = value;
    }
    public setStrokeCap(value: Cap): void {
        this.strokeCap = value;
    }
    public isDither(): boolean {
        return this.dither;
    }
    public setAlpha(value: number): void {
        this.alpha = value;
    }
    public setStyle(value: Style): void {
        this.style = value;
    }
    public getStrokeMiter(): number {
        return this.strokeMiter;
    }
    public setDither(value: boolean): void {
        this.dither = value;
    }
    public setAntiAlias(value: boolean): void {
        this.antiAlias = value;
    }
    public getStrokeWidth(): number {
        return this.strokeWidth;
    }
    public getStrokeCap(): Cap {
        return this.strokeCap;
    }
    public setShader(value: any) {
        if (this.shader) {
            this.shader.release();
        }
        this.shader = value;
    }
    constructor() {
        // this.font = Font.default;
    }

    get font() {
        if (!this._font) {
            this._font = Font.default;
        }
        return this._font;
    }

    setFontFamily(familyName: string) {
        this._font = this.font.withFontFamily(familyName);
        this._textAttribs = null;
    }

    getUIFont(): UIFont {
        return this.font.getUIFont(UIFont.systemFontOfSize(UIFont.smallSystemFontSize));
    }
    getUIColor() {
        return (this.color as Color).ios as UIColor;
    }

    public getTextSize(): number {
        return this.textSize;
    }

    set textSize(textSize) {
        this._font = this.font.withFontSize(textSize);
        this._textAttribs = null;
    }
    get textSize() {
        return this._font ? this._font.fontSize : UIFont.labelFontSize;
    }
    setTextSize(textSize) {
        this.textSize = textSize;
    }
    get color(): Color | number | string {
        return this._color;
    }
    set color(color: Color | number | string) {
        if (color instanceof Color) {
            this._color = color;
        } else {
            this._color = new Color(color as any);
        }
    }
    setColor(color: Color | number | string) {
        this.color = color as any;
    }
    getColor(): Color {
        return this._color;
    }

    clear() {
        if (this.shader) {
            this.shader.clear();
            this.shader = null;
        }
    }
    pathEffect: PathEffect;
    public setPathEffect(param0: PathEffect) {
        this.pathEffect = param0;
    }

    public getFontMetrics(fontMetrics?: FontMetrics): any {
        let returnFontMetrics = false;
        if (!fontMetrics) {
            fontMetrics = new FontMetrics();
            returnFontMetrics = true;
        }
        // if (fontMetrics) {
        const uiFont = this.getUIFont();
        fontMetrics.ascent = -uiFont.ascender;
        fontMetrics.descent = -uiFont.descender;
        fontMetrics.bottom = 0;
        fontMetrics.top = -uiFont.ascender;
        fontMetrics.leading = uiFont.leading;

        if (returnFontMetrics) {
            return fontMetrics;
        } else {
            return fontMetrics.descent - fontMetrics.ascent;
        }
    }

    drawShader(ctx) {
        if (this.shader instanceof LinearGradient) {
            // const color =UIColor.clearColor
            // CGContextSetFillColorWithColor(ctx, color.CGColor);
            // CGContextSetStrokeColorWithColor(ctx, color.CGColor);
            const g = this.shader;
            const options = g.tileMode === TileMode.CLAMP ? CGGradientDrawingOptions.kCGGradientDrawsBeforeStartLocation | CGGradientDrawingOptions.kCGGradientDrawsAfterEndLocation : 0;
            // const path = CGContextCopyPath(ctx);
            CGContextSaveGState(ctx);
            if (this.style === Style.STROKE) {
                CGContextReplacePathWithStrokedPath(ctx);
            }
            CGContextClip(ctx);
            CGContextDrawLinearGradient(ctx, g.gradient, CGPointMake(g.x0, g.y0), CGPointMake(g.x1, g.y1), options);
            CGContextRestoreGState(ctx);
            // CGContextAddPath(ctx, path);
        } else if (this.shader instanceof RadialGradient) {
            // const color =UIColor.clearColor
            // CGContextSetFillColorWithColor(ctx, color.CGColor);
            // CGContextSetStrokeColorWithColor(ctx, color.CGColor);
            const g = this.shader;
            const options = g.tileMode === TileMode.CLAMP ? CGGradientDrawingOptions.kCGGradientDrawsBeforeStartLocation | CGGradientDrawingOptions.kCGGradientDrawsAfterEndLocation : 0;
            if (this.style === Style.STROKE) {
                CGContextReplacePathWithStrokedPath(ctx);
            }
            // const path = CGContextCopyPath(ctx);
            CGContextSaveGState(ctx);
            CGContextClip(ctx);
            CGContextDrawRadialGradient(ctx, g.gradient, CGPointMake(g.centerX, g.centerY), 0, CGPointMake(g.centerX, g.centerY), g.radius, options);
            CGContextRestoreGState(ctx);
            // CGContextAddPath(ctx, path);
        }
    }
    _textAttribs: NSMutableDictionary<any, any>;
    getDrawTextAttribs() {
        if (!this._textAttribs) {
            this._textAttribs = NSMutableDictionary.dictionaryWithObjectsForKeys(
                [this.getUIFont(), kCFBooleanTrue, this.getUIColor()],
                [NSFontAttributeName, kCTForegroundColorFromContextAttributeName, NSForegroundColorAttributeName]
            );
            if (this.align === Align.CENTER) {
                const paragraphStyle = NSMutableParagraphStyle.new();
                paragraphStyle.alignment = NSTextAlignment.Center;
                this._textAttribs.setObjectForKey(paragraphStyle, NSParagraphStyleAttributeName);
            } else if (this.align === Align.RIGHT) {
                const paragraphStyle = NSMutableParagraphStyle.new();
                paragraphStyle.alignment = NSTextAlignment.Right;
                this._textAttribs.setObjectForKey(paragraphStyle, NSParagraphStyleAttributeName);
            }
        }
        return this._textAttribs;
    }
}

export class Canvas implements ICanvas {
    _cgContext: any; // CGContextRef;
    _paint: Paint = new Paint();
    needsApplyDefaultPaint = true;
    _width: number;
    _height: number;
    _scale = 1;

    setBitmap(image) {
        // if (image instanceof ImageSource) {
        //     this._bitmap = image.android;
        // } else {
        //     this._bitmap = image;
        // }
        // this.setBitmap(this._bitmap);
    }

    release(): any {
        this._cgContext = null;
        if (this._paint) {
            this._paint.clear();
        }
    }
    clear() {
        this.drawColor('transparent');
    }
    get ctx() {
        return this._cgContext;
    }
    setContext(context, width, height): any {
        // console.error('setContext', context, width, height);
        this._cgContext = context;
        this._width = width;
        this._height = height;
    }
    getDensity(): number {
        // console.error('Method not implemented:', 'centerY');
        return this._scale;
    }
    setDensity(density: number): void {
        this._scale = density;
        // TODO: recreate context when possible
    }
    getDrawFilter(): any {
        console.error('Method not implemented:', 'getDrawFilter');
    }
    setDrawFilter(filter: any): void {
        console.error('Method not implemented:', 'setDrawFilter');
    }

    rotate(...args) {
        // rotate(degrees: number) {}
        // rotate(degrees: number, px: number, py: number): void;
        // rotate(degrees: any, px?: any, py?: any)
        const length = args.length;
        const degrees = args[0];
        const ctx = this.ctx;

        if (length === 3) {
            const px = args[1];
            const py = args[2];
            CGContextTranslateCTM(ctx, px, py);
            CGContextRotateCTM(ctx, (Math.PI / 180) * degrees);
            CGContextTranslateCTM(ctx, -px, -py);
        } else {
            CGContextRotateCTM(ctx, (Math.PI / 180) * degrees);
        }
    }

    scale(...args) {
        // scale(sx: number, sy: number, px: number, py: number): void;
        // scale(sx: number, sy: number): void;
        // scale(sx: any, sy: any, px?: any, py?: any)
        const length = args.length;
        const ctx = this.ctx;
        const sx = args[0];
        const sy = args[1];

        if (length === 4) {
            const px = args[2];
            const py = args[3];
            CGContextTranslateCTM(ctx, px, py);
            CGContextScaleCTM(ctx, sx, sy);
            CGContextTranslateCTM(ctx, -px, -py);
        } else {
            CGContextScaleCTM(ctx, sx, sy);
        }
    }

    translate(dx: number, dy: number): void {
        CGContextTranslateCTM(this.ctx, dx, dy);
    }
    skew(sx: number, sy: number): void {
        console.error('Method not implemented:', 'skew');
    }

    getClipBounds(): IRect {
        return new Rect(CGContextGetClipBoundingBox(this.ctx));
    }
    restoreCount = 0;
    restore(): void {
        CGContextRestoreGState(this.ctx);
        this.restoreCount--;
    }
    restoreToCount(count): void {
        // console.log('restoreToCount', count), this.restoreCount;
        while (this.restoreCount >= count) {
            this.restore();
        }
    }
    save(): number {
        // console.log('save', this.restoreCount);
        this.restoreCount++;
        CGContextSaveGState(this.ctx);
        return this.restoreCount;
    }

    @paint
    drawPaint(paint: Paint): void {
        // this.save();
        const ctx = this.ctx;
        CGContextFillRect(ctx, CGRectMake(0, 0, this._width, this._height));
        paint.drawShader(ctx);
        // this.restore();
    }

    drawARGB(a: number, r: number, g: number, b: number): void {
        this.save();
        const ctx = this.ctx;
        CGContextSetRGBFillColor(ctx, r / 255, g / 255, b / 255, a / 255);
        CGContextFillRect(ctx, CGRectMake(0, 0, this._width, this._height));
        this.restore();
    }

    drawRGB(r: number, g: number, b: number): void {
        this.drawARGB(255, r, g, b);
    }

    drawColor(color: number | Color | string): void {
        const ctx = this.ctx;
        const actualColor = color instanceof Color ? color : new Color(color as any);
        this.save();

        CGContextSetFillColorWithColor(ctx, actualColor.ios.CGColor);
        CGContextFillRect(ctx, CGRectMake(0, 0, this._width, this._height));
        this.restore();
    }

    @paint
    drawBitmap(...args) {
        // drawBitmap(bitmap: globalAndroid.graphics.Bitmap | UIImage | ImageSource, src: IRect, dest: IRect, paint: IPaint): void;
        // drawBitmap(bitmap: globalAndroid.graphics.Bitmap | UIImage | ImageSource, x: number, y: number, paint: IPaint): void;
        // drawBitmap(bitmap: any, x: any, y: any, paint: any)
        const ctx = this.ctx;
        let image: UIImage = args[0];
        if (image instanceof ImageSource) {
            image = image.ios;
        }
        if (!image) {
            return;
        }
        const dst = args[2] instanceof Rect ? args[2].cgRect : CGRectMake(args[1], args[2], image.size.width, image.size.height);

        // CGContextSaveGState(ctx);
        CGContextTranslateCTM(ctx, 0, dst.origin.y + dst.size.height);
        CGContextScaleCTM(ctx, 1.0, -1.0);
        CGContextDrawImage(ctx, CGRectMake(dst.origin.x, 0, dst.size.width, dst.size.height), image.CGImage);
        // CGContextRestoreGState(ctx);
    }

    drawPoint(x: number, y: number, paint: Paint): void {
        this.drawLine(x, y, x, y, paint);
    }
    drawPoints(...args): void {
        // drawLines(pts: number[], offset: number, count: number, paint: IPaint): void;
        // drawLines(pts: number[], paint: IPaint): void;

        const pts = args[0] as number[];
        if (pts.length <= 0 || pts.length % 4 !== 0) {
            console.error('wrong points number');
        }

        const length = args.length;
        const paint = args[length - 1] as Paint;
        const ctx = this.ctx;
        let offset = 0;
        let count = pts.length;
        let rect: CGRect;
        if (length === 4) {
            offset = args[1];
            count = args[2];
        }
        CGContextBeginPath(ctx);
        for (let index = offset; index < count / 2; index++) {
            CGContextMoveToPoint(ctx, pts[offset], pts[offset + 1]);
            CGContextAddLineToPoint(ctx, pts[offset], pts[offset + 1]);
        }
        this._drawPath(paint, ctx);
    }
    @paint
    drawLine(startX: number, startY: number, stopX: number, stopY: number, paint: Paint): void {
        const oldStyle = paint.style;
        paint.style = Style.STROKE;
        const ctx = this.ctx;
        CGContextBeginPath(ctx);
        CGContextMoveToPoint(ctx, startX, startY);
        CGContextAddLineToPoint(ctx, stopX, stopY);
        this._drawPath(paint, ctx);
        paint.style = oldStyle;
    }
    @paint
    drawLines(...args) {
        // drawLines(pts: number[], offset: number, count: number, paint: IPaint): void;
        // drawLines(pts: number[], paint: IPaint): void;

        let pts = args[0];
        if (pts.length <= 0 || pts.length % 2 !== 0) {
            console.error('wrong points number');
        }

        let matrix: Matrix = args[args.length - 1];
        if (matrix instanceof Matrix) {
            args.pop();
        } else {
            matrix = undefined;
        }

        const length = args.length;

        const paint = args[length - 1] as Paint;
        // const oldStyle = paint.style;
        paint.style = Style.STROKE;
        // const ctx = this.ctx;
        let offset = 0;
        let count = pts.length;
        // let rect: CGRect;
        if (length === 4) {
            offset = args[1];
            count = args[2];
        }
        const startTime = Date.now();

        if (Array.isArray(pts)) {
            pts = FloatConstructor.from(pts);
        }

        UIBezierPath.drawLineSegmentsCountInContextWithTransform(pts, count, this.ctx, matrix ? matrix._transform : identity);

        // const realCount = count / 2
        // const cgPoints = new FloatConstructor(realCount) as any;
        // console.log('drawPointsCountInContextWithTransform', Date.now() - startTime);
        // let cgPoint;
        // for (let index = offset; index <= realCount; index++) {
        //     cgPoint = CGPointMake(pts[2 * index], pts[2 * index + 1]);
        //     if (matrix) {
        //         // cgPoint = CGPointApplyAffineTransform(cgPoint, matrix._transform);
        //     }
        //     cgPoints[index] = cgPoint;
        //     // CGContextAddLineToPoint(ctx, pts[index], pts[index + 1]);
        // }
        // console.log('test1', Date.now() - startTime);

        // // CGContextBeginPath(ctx);
        // CGContextStrokeLineSegments(ctx, cgPoints as any, realCount);
        // console.log('test2', Date.now() - startTime);
        // CGContextMoveToPoint(ctx, pts[offset], pts[offset + 1]);
        // for (let index = offset + 2; index <= count / 2; index++) {
        //     CGContextAddLineToPoint(ctx, pts[index], pts[index + 1]);
        // }
        // this._drawPath(paint, ctx);
        // paint.style = oldStyle;
    }

    concat(mat: Matrix) {
        CGContextConcatCTM(this.ctx, mat._transform);
    }
    @paint
    drawCircle(cx: number, cy: number, radius: number, paint: Paint): void {
        const ctx = this.ctx;
        const hR = radius / 2;
        const rect = CGRectMake(cx - radius, cy - radius, radius * 2, radius * 2);
        CGContextBeginPath(ctx);
        CGContextAddEllipseInRect(ctx, rect);
        this._drawPath(paint, ctx);
    }
    drawOval(...args) {
        // drawOval(rect: IRect, paint: IPaint): void;
        // drawOval(left: number, top: number, right: number, bottom: number, paint: IPaint): void;
        // drawOval(left: any, top: any, right?: any, bottom?: any, paint?: any)
        console.error('Method not implemented:', 'drawOval');
    }
    @paint
    drawPath(path: Path, paint: Paint): void {
        const ctx = this.ctx;
        if (path._fillType === FillType.EVEN_ODD) {
            CGContextBeginPath(ctx);
            CGContextAddPath(ctx, path.getCGPath());
            this._drawEOFPath(paint, ctx);
        } else {
            this._drawPath(paint, ctx, path.getBPath() || path.getCGPath());
        }
    }
    clipOutPath(path: IPath): boolean {
        console.error('Method not implemented:', 'clipOutPath');
        return false;
    }
    clipOutRect(...args) {
        // clipOutRect(left: number, top: number, right: number, bottom: number): boolean;
        // clipOutRect(rect: IRect): boolean;
        const ctx = this.ctx;
        let rect: CGRect;
        if (length === 4) {
            rect = createCGRect(args[0], args[1], args[2], args[3]);
        } else if (length === 1) {
            rect = (args[0] as Rect).cgRect;
        }
        const currentRect = CGContextGetClipBoundingBox(ctx);
        CGRect;
        console.error('Method not implemented:', 'clipOutRect');
        return false;
    }
    clipPath(...args) {
        const path = args[0] as Path;
        const ctx = this.ctx;
        CGContextAddPath(ctx, path.getCGPath());
        CGContextClip(ctx);
        // clipPath(path: IPath): boolean;
        // clipPath(path: IPath, op: Op): boolean;
        // clipPath(path: any, op?: any)
        return true;
    }
    @paint
    drawView(view: View, rect?: Rect) {
        if (!view.nativeView) {
            (view as any)._setupAsRootView({});
            (view as any)._isAddedToNativeVisualTree = true;
            (view as any).callLoaded();
        }
        if (view.nativeView) {
            const uiView = view.nativeView as UIView;
            if (rect) {
                // Lay the view out with the known dimensions
                view.layout(0, 0, rect.width(), rect.height());

                // Translate the canvas so the view is drawn at the proper coordinates
                this.save();
                this.translate(rect.left, rect.top);
            }
            // uiView.drawLayerInContext(uiView.layer, this.ctx);
            uiView.drawViewHierarchyInRectAfterScreenUpdates(rect.cgRect, true);
            if (rect) {
                this.restore();
            }
        }
    }
    getWidth() {
        return this._width;
    }
    getHeight() {
        return this._height;
    }
    constructor(imageOrWidth: ImageSource | UIImage | number, height?: number) {
        if (imageOrWidth instanceof ImageSource) {
            this._cgContext = this._createContextFromImage(imageOrWidth.ios);
        } else if (imageOrWidth instanceof UIImage) {
            this._cgContext = this._createContextFromImage(imageOrWidth);
        } else if (imageOrWidth > 0 && height > 0) {
            this._cgContext = this._createContext(imageOrWidth, height);
        }
        // CGContextFillRect(this._cgContext);
    }

    startApplyPaint(paint: Paint, withFont = false) {
        this.save();
        if (!paint) {
            paint = this._paint;
            if (this.needsApplyDefaultPaint) {
                this.needsApplyDefaultPaint = false;
            } else {
                return paint;
            }
        } else {
            if (paint !== this._paint) {
                this.needsApplyDefaultPaint = true;
            }
        }
        // console.log('applyPaint', paint, paint === this._paint, withFont);

        const ctx = this._cgContext;
        paint.currentContext = ctx;
        CGContextSetAlpha(ctx, paint.alpha);
        CGContextSetShouldAntialias(ctx, paint.antiAlias);
        CGContextSetShouldSmoothFonts(ctx, paint.antiAlias);

        if (paint.shadowLayer) {
            const s = paint.shadowLayer;
            CGContextSetShadowWithColor(ctx, CGSizeMake(s.dx, s.dy), s.radius, s.color.ios.CGColor);
        } else {
            CGContextSetShadow(ctx, CGSizeZero, 0);
        }
        if (paint.strokeWidth) {
            CGContextSetLineWidth(ctx, paint.strokeWidth);
        }
        if (paint.strokeCap) {
            CGContextSetLineCap(ctx, paint.strokeCap as any);
        }
        if (paint.strokeJoin) {
            CGContextSetLineJoin(ctx, paint.strokeJoin as any);
        }
        if (!!paint.pathEffect) {
            if (paint.pathEffect instanceof DashPathEffect) {
                const intervals = paint.pathEffect.intervals;
                const length = intervals.length;
                CGContextSetLineDash(ctx, paint.pathEffect.phase, FloatConstructor.from(intervals) as any, length);
            }
        }
        if (paint.color) {
            // const color = paint.getColor();
            // const r = color.r / 255;
            // const g = color.g / 255;
            // const b = color.b / 255;
            // const a = color.a / 255;
            // console.log('apply color', color, r, g, b ,a);
            // CGContextSetRGBFillColor(ctx, r, g, b, a);
            // CGContextSetRGBStrokeColor(ctx, r, g, b, a);

            const color = paint.getUIColor();
            CGContextSetStrokeColorWithColor(ctx, color.CGColor);
            CGContextSetFillColorWithColor(ctx, color.CGColor);
        }

        if (withFont && paint.font) {
            const font = paint.getUIFont();
            CGContextSelectFont(ctx, font.fontDescriptor.postscriptName, font.pointSize, CGTextEncoding.kCGEncodingMacRoman);
            // CGContextSetCharacterSpacing(ctx, 1.7);
            const transform = CGAffineTransformMake(1.0, 0.0, 0.0, -1.0, 0.0, 0.0);
            CGContextSetTextMatrix(ctx, transform);
        }
        return paint;
    }
    finishApplyPaint(paint) {
        paint.currentContext = null;
        const ctx = this._cgContext;
        CGContextSetLineDash(ctx, 0, null, 0);
        this.restore();
    }

    _createContextFromImage(source: UIImage) {
        const w = source.size.width;
        const h = source.size.height;
        // this._width = layout.toDeviceIndependentPixels(w);
        // this._height = layout.toDeviceIndependentPixels(h);
        this._width = w;
        this._height = h;
        const rect = CGRectMake(0, 0, w, h);

        UIGraphicsBeginImageContextWithOptions(source.size, false, source.scale);
        const context = UIGraphicsGetCurrentContext();
        // draw black background to preserve color of transparent pixels
        CGContextSetBlendMode(context, CGBlendMode.kCGBlendModeNormal);

        // draw original image
        CGContextSaveGState(context);
        CGContextTranslateCTM(context, 0, source.size.height);
        CGContextScaleCTM(context, 1.0, -1.0);
        CGContextDrawImage(context, rect, source.CGImage);
        CGContextRestoreGState(context);

        return context;
    }

    _createContext(w, h) {
        this._width = w;
        this._height = h;
        let context = null;
        let colorSpace;
        const scaleFactor = this._scale;
        const bitmapBytesPerRow = w * 4 * scaleFactor; // 1
        colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceGenericRGB); // 2
        context = CGBitmapContextCreate(
            null, // 4
            w * scaleFactor,
            h * scaleFactor,
            8, // bits per component
            bitmapBytesPerRow,
            colorSpace,
            CGImageAlphaInfo.kCGImageAlphaPremultipliedLast
        );
        CGContextScaleCTM(context, 1 / scaleFactor, 1 / scaleFactor);
        CGColorSpaceRelease(colorSpace); // 6
        return context; // 7
    }

    @paint
    fillRect(x: number, y: number, w: number, h: number, paint?: Paint) {
        const ctx = this.ctx;
        // const color = paint.getColor();
        CGContextBeginPath(ctx);
        CGContextAddRect(ctx, createCGRect(x, y, w, h));
        this._drawPath(paint, ctx);
    }

    @paint
    drawRect(...params) {
        const length = params.length;
        const paint = params[length - 1] as Paint;
        const ctx = this.ctx;
        let rect: CGRect;
        if (length === 5) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
        } else if (length === 2) {
            rect = (params[0] as Rect).cgRect;
        }
        CGContextBeginPath(ctx);
        CGContextAddRect(ctx, rect);
        this._drawPath(paint, ctx);
    }

    @paint
    drawImage(x: number, y: number, w: number, h: number, image: ImageSource | UIImage) {
        const ctx = this.ctx;
        const theImage: UIImage = image instanceof ImageSource ? image.ios : image;
        CGContextDrawImage(ctx, createCGRect(x, y, w, h), theImage.CGImage);
    }
    clipRect(...params) {
        const ctx = this.ctx;
        const length = params.length;
        let rect: CGRect;
        if (length === 4) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
        } else if (length === 1) {
            rect = (params[0] as Rect).cgRect;
        }
        CGContextClipToRect(ctx, rect);
        return true;
    }
    private _drawEOFPath(paint: Paint, ctx) {
        if (paint.style === Style.FILL) {
            CGContextEOFillPath(ctx);
        } else if (paint.style === Style.STROKE) {
            CGContextDrawPath(ctx, CGPathDrawingMode.kCGPathStroke);
        } else {
            CGContextEOFillPath(ctx);
            CGContextDrawPath(ctx, CGPathDrawingMode.kCGPathStroke);
        }
        paint.drawShader(ctx);
    }
    private _drawPath(paint: Paint, ctx, path?) {
        let bPath: UIBezierPath;
        if (path instanceof UIBezierPath) {
            bPath = path;
            path = bPath.CGPath;
            // } else {
            // path = path || CGContextCopyPath(ctx);
            // bPath = UIBezierPath.bezierPathWithCGPath(path);
            // } else if (path) {
            // bPath = UIBezierPath.bezierPathWithCGPath(path);
        }
        //  path =CGContextCopyPath(ctx);
        if (paint.shader && !path) {
            path = CGContextCopyPath(ctx);
        }
        // const bPath = UIBezierPath.bezierPathWithCGPath(path);
        // if (!!paint.pathEffect) {
        if (paint.pathEffect instanceof DashPathEffect) {
            // if (!path) {
            //     path = CGContextCopyPath(ctx);
            // }
            if (!bPath) {
                if (!path) {
                    path = CGContextCopyPath(ctx);
                }
                bPath = UIBezierPath.bezierPathWithCGPath(path);
            }
            // const intervals = paint.pathEffect.intervals;
            // const length = intervals.length;
            // const buffer = interop.alloc(length * interop.sizeof(interop.types.float));
            // const reference = new interop.Reference(interop.types.float, buffer);
            // for (let i = 0; i < length; i++) {
            //     reference[i] = intervals[i];
            // }

            // const view = new Float32Array(length);
            // for (let i = 0; i < length; i++) {
            //     view[i] = intervals[i];
            // }
            // const intervals = paint.pathEffect.intervals;
            // const outerPtr = interop.alloc(interop.sizeof(interop.Pointer));
            // const outerRef = new interop.Reference(interop.types.id, outerPtr);
            // outerRef.value = intervals;
            const intervals = paint.pathEffect.intervals;
            const length = intervals.length;
            // const newPath = CGPathCreateCopyByDashingPath(path, null, paint.pathEffect.phase, FloatConstructor.from(intervals) as any, length);
            // CGContextBeginPath(ctx);
            // CGContextAddPath(ctx, newPath);

            // const bPath = UIBezierPath.bezierPathWithCGPath(path);
            bPath.setLineDashCountPhase(FloatConstructor.from(intervals) as any, length, paint.pathEffect.phase);
            // CGContextAddPath(ctx, bPath.CGPath);

            // return;
            // console.log('CGContextSetLineDash2', paint.pathEffect.phase, view, length);

            // console.log('CGContextSetLineDash', intervals, length, paint.pathEffect.phase);
            // CGContextSetLineDash(ctx, paint.pathEffect.phase, FloatConstructor.from(intervals) as any, length);
        }
        // }

        if (bPath) {
            // console.log('_drawPath', !!path, !!paint.shader, !!paint.pathEffect, bPath.lineCapStyle, bPath.lineJoinStyle, bPath.shouldGroupAccessibilityChildren, bPath.usesEvenOddFillRule, bPath.miterLimit, bPath.flatness, bPath.lineWidth, bPath.currentPoint.x, bPath.currentPoint.y);
            bPath.lineWidth = paint.strokeWidth;
            bPath.lineCapStyle = paint.strokeCap as any;
            bPath.lineJoinStyle = paint.strokeJoin as any;

            UIGraphicsPushContext(ctx);
            if (paint.style === Style.FILL) {
                paint.getUIColor().setFill();
                bPath.fill();
            } else if (paint.style === Style.STROKE) {
                paint.getUIColor().setStroke();
                bPath.stroke();
            } else {
                paint.getUIColor().setStroke();
                paint.getUIColor().setFill();
                bPath.fill();
                bPath.stroke();
            }
            UIGraphicsPopContext();
        } else {
            if (path) {
                CGContextAddPath(ctx, path);
            }
            if (paint.style === Style.FILL) {
                // CGContextFillPath(ctx);
                CGContextDrawPath(ctx, CGPathDrawingMode.kCGPathFill);
            } else if (paint.style === Style.STROKE) {
                CGContextDrawPath(ctx, CGPathDrawingMode.kCGPathStroke);
            } else {
                CGContextDrawPath(ctx, CGPathDrawingMode.kCGPathFillStroke);
            }
        }

        if (path && paint.shader) {
            CGContextAddPath(ctx, path);
            paint.drawShader(ctx);
        }
    }

    @paint
    drawRoundRect(...params) {
        // drawRoundRect(left: number, top: number, right: number, bottom: number, rx: number, ry: number, paint: IPaint): void;
        // drawRoundRect(rect: IRect, rx: number, ry: number, paint: IPaint): void;
        // drawRoundRect(left: any, top: any, right: any, bottom: any, rx?: any, ry?: any, paint?: any)
        const length = params.length;
        const paint = params[length - 1] as Paint;
        const ctx = this.ctx;
        let radius, rect: CGRect;
        if (length === 7) {
            radius = Math.max(params[4], params[5]);
            rect = createCGRect(params[0], params[1], params[2], params[3]);
        } else {
            radius = Math.max(params[1], params[2]);
            rect = (params[0] as Rect).cgRect;
        }
        const path = UIBezierPath.bezierPathWithRoundedRectCornerRadius(rect, radius);
        // CGContextAddPath(ctx, path.CGPath);
        this._drawPath(paint, ctx, path);
    }

    @paint
    drawArc(...params) {
        // drawArc(rect: Rect, startAngle: number, sweepAngle: number, useCenter: boolean, paint: Paint): void;
        // drawArc(left: number, top: number, right: number, bottom: number, startAngle: number, sweepAngle: number, useCenter: boolean, paint: Paint): void;
        const length = params.length;
        const paint = params[length - 1] as Paint;
        const ctx = this.ctx;

        let rect: CGRect,
            sweepAngle,
            startAngle,
            useCenter = false;
        if (length === 8) {
            rect = createCGRect(params[0], params[1], params[2], params[3]);
            sweepAngle = params[5];
            startAngle = params[4];
            useCenter = params[6];
        } else if (length === 5) {
            rect = (params[0] as Rect).cgRect;
            sweepAngle = params[2];
            startAngle = params[1];
            useCenter = params[3];
        }
        const w = rect.size.width;
        const h = rect.size.height;
        const cx = rect.origin.x + w * 0.5;
        const cy = rect.origin.y + h * 0.5;
        const r = rect.size.width * 0.5;

        const path = CGPathCreateMutable();
        let t = CGAffineTransformMakeTranslation(cx, cy);
        t = CGAffineTransformConcat(CGAffineTransformMakeScale(1.0, h / w), t);
        if (useCenter) {
            CGPathMoveToPoint(path, null, cx, cy);
            // CGContextMoveToPoint(ctx, cx, cy);
        }
        CGPathAddArc(path, new interop.Reference(t), 0, 0, r, (startAngle * Math.PI) / 180, ((startAngle + sweepAngle) * Math.PI) / 180, false);
        if (useCenter) {
            CGPathAddLineToPoint(path, null, cx, cy);
            // CGContextAddLineToPoint(ctx, cx, cy);
        }
        CGContextAddPath(ctx, path);

        this._drawPath(paint, ctx);

        // CFRelease(path);
    }
    @paint
    drawText(...params) {
        const startTime = Date.now();
        // drawText(text: string, start: number, end: number, x: number, y: number, paint: Paint): void;
        // drawText(char: any[], index: number, count: number, x: number, y: number, paint: Paint): void;
        // drawText(text: string, x: number, y: number, paint: Paint): void;
        const length = params.length;
        const paint = params[length - 1] as Paint;
        const ctx = this.ctx;

        let x, y, text;
        if (length === 6) {
            text = params[0];
            x = params[3];
            y = params[4];
        } else if (length === 4) {
            text = params[0];
            x = params[1];
            y = params[2];
        }
        // const attribs = paint.getDrawTextAttribs();
        // const nsstring = NSString.stringWithString(text.replace(/\n/g, ' '));
        // const attrString = NSAttributedString.alloc().initWithStringAttributes(text.replace(/\n/g, ' '), attribs);
        let offsetx = x;
        let offsety = y;
        if (paint.align !== Align.LEFT) {
            let width = paint.measureText(text);
            if (paint.align === Align.RIGHT) {
                offsetx -= width;
            } else {
                offsetx -= width / 2;
            }
        }
        // UIGraphicsPushContext(ctx);
        if (paint.style === Style.FILL) {
            CGContextSetTextDrawingMode(ctx, CGTextDrawingMode.kCGTextFill);
        } else if (paint.style === Style.STROKE) {
            CGContextSetTextDrawingMode(ctx, CGTextDrawingMode.kCGTextStroke);
        } else {
            CGContextSetTextDrawingMode(ctx, CGTextDrawingMode.kCGTextFillStroke);
        }
        // nsstring.drawAtPointWithAttributes(CGPointMake(offsetx, offsety), attribs);
        // UIGraphicsPopContext();
        CGContextShowTextAtPoint(ctx, offsetx, offsety, text, text.length);
    }
    @paint
    drawTextOnPath(text: string, path: Path, hOffset: number, vOffset: number, paint: Paint): void {
        const ctx = this.ctx;
        let bPath = path.getOrCreateBPath();
        if (hOffset !== 0 || vOffset !== 0) {
            bPath.applyTransform(CGAffineTransformMakeTranslation(hOffset, vOffset));
            // const offsetpath = new Path();
            // path.offset(hOffset, vOffset, offsetpath);
            // bPath = UIBezierPath.bezierPathWithCGPath(offsetpath._path);
            // } else {
            // bPath =path.getOrCreateBPath();
        }
        if (paint.style === Style.FILL) {
            CGContextSetTextDrawingMode(ctx, CGTextDrawingMode.kCGTextFill);
        } else if (paint.style === Style.STROKE) {
            CGContextSetTextDrawingMode(ctx, CGTextDrawingMode.kCGTextStroke);
        } else {
            CGContextSetTextDrawingMode(ctx, CGTextDrawingMode.kCGTextFillStroke);
        }
        const attribs = paint.getDrawTextAttribs();
        const fontStr = NSAttributedString.alloc().initWithStringAttributes(text, attribs);
        UIGraphicsPushContext(ctx);
        bPath.drawAttributedString(fontStr);
        UIGraphicsPopContext();
    }
    drawTextRun(text: string, start: number, end: number, contextStart: number, contextEnd: number, x: number, y: number, isRtl: boolean, paint: IPaint): void {
        console.error('Method not implemented:', 'drawTextRun');
    }
    drawPosText(...arg) {
        // drawPosText(text: string, pos: number[], paint: IPaint): void;
        // drawPosText(text: string[], index: number, count: number, pos: number[], paint: IPaint): void;
        // drawPosText(text: any, index: any, count: any, pos?: any, paint?: any)
        console.error('Method not implemented:', 'drawPosText');
    }

    getCGImage() {
        return CGBitmapContextCreateImage(this.ctx);
    }

    getImage() {
        const imageRef = CGBitmapContextCreateImage(this.ctx);
        const result = UIImage.imageWithCGImageScaleOrientation(imageRef, this._scale, UIImageOrientation.Up);
        // CGImageRelease(imageRef);
        return result;
    }
}

export function createImage(options: { width: number; height: number; scale?: number }) {
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(options.width, options.height), false, options.scale);
    const output = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return new ImageSource(output);
}
export function releaseImage(image: ImageSource) {}

export class UICustomCanvasView extends UIView {
    _canvas: Canvas; // CGContextRef;
    public _owner: WeakRef<CanvasView>;

    public static initWithOwner(owner: WeakRef<CanvasView>): UICustomCanvasView {
        const view = UICustomCanvasView.new() as UICustomCanvasView;
        view.contentMode = UIViewContentMode.Redraw;
        view.opaque = false;
        view._owner = owner;
        return view;
    }

    drawRect(dirtyRect) {
        // only used to trigger drawLayer
    }

    drawLayerInContext(layer: CALayer, context: any) {
        super.drawLayerInContext(layer, context);
        const size = this.bounds.size;
        const owner = this._owner && this._owner.get();
        if (!this._canvas) {
            this._canvas = new Canvas(0, 0);
        }
        this._canvas.setContext(context, size.width, size.height);
        // this._canvas.scale(1 / owner.density, 1 / owner.density);
        // this._canvas.setDensity(owner.density);
        if (owner.shapesCanvas) {
            const canvas = owner.shapesCanvas as Canvas;
            // canvas.setDensity(owner.density);
            const viewport = CGRectMake(0, 0, size.width, size.height);
            const image = canvas.getCGImage();
            CGContextDrawImage(context, viewport, image);
        } else if (!owner.cached && owner.shapes) {
            const shapes = owner.shapes;
            if (shapes.shapes.length > 0) {
                shapes.shapes.forEach(s => s.drawMyShapeOnCanvas(this._canvas));
            }
        }
        owner.onDraw(this._canvas);
    }
}

export class CanvasView extends CanvasBase {
    onDraw(canvas: Canvas) {
        this.notify({ eventName: 'draw', object: this, canvas: canvas });
    }
    nativeViewProtected: UICustomCanvasView;
    createNativeView() {
        return UICustomCanvasView.initWithOwner(new WeakRef(this));
    }
    _onSizeChanged() {
        super._onSizeChanged();
        this.onSizeChanged(layout.toDeviceIndependentPixels(this.getMeasuredWidth()), layout.toDeviceIndependentPixels(this.getMeasuredHeight()), -1, -1);
    }
    redraw() {
        if (this.nativeViewProtected) {
            const layer = this.nativeViewProtected.layer;
            layer.setNeedsDisplay();
            layer.displayIfNeeded();
        }
    }
    invalidate() {
        if (this.nativeViewProtected) {
            const layer = this.nativeViewProtected.layer;
            layer.setNeedsDisplay();
            layer.displayIfNeeded();
        }
    }
}

export class LinearGradient {
    _gradient;
    constructor(public x0: number, public y0: number, public x1: number, public y1: number, public colors: any, public stops: any, public tileMode: TileMode) {}
    get gradient() {
        if (!this._gradient) {
            if (Array.isArray(this.colors)) {
                const cgColors = this.colors.map(c => (c instanceof Color ? c : new Color(c)).ios.CGColor);
                this._gradient = CGGradientCreateWithColors(CGColorSpaceCreateDeviceRGB(), cgColors as any, null);
                CFRetain(this._gradient);
            } else {
                const cgColors = [this.colors, this.stops].map(c => (c instanceof Color ? c : new Color(c)).ios.CGColor);
                this._gradient = CGGradientCreateWithColors(CGColorSpaceCreateDeviceRGB(), cgColors as any, null);
                CFRetain(this._gradient);
            }
        }
        return this._gradient;
    }
    release() {
        if (this._gradient) {
            CFRelease(this._gradient);
            this._gradient = undefined;
        }
    }
}
export class RadialGradient {
    _gradient;
    constructor(public centerX: number, public centerY: number, public radius: number, public colors: any, public stops: any, public tileMode: TileMode) {}
    get gradient() {
        if (!this._gradient) {
            if (Array.isArray(this.colors)) {
                const cgColors = this.colors.map(c => (c instanceof Color ? c : new Color(c)).ios.CGColor);
                this._gradient = CGGradientCreateWithColors(CGColorSpaceCreateDeviceRGB(), cgColors as any, null);
                CFRetain(this._gradient);
            } else {
                const cgColors = [this.colors, this.stops].map(c => (c instanceof Color ? c : new Color(c)).ios.CGColor);
                this._gradient = CGGradientCreateWithColors(CGColorSpaceCreateDeviceRGB(), cgColors as any, null);
                CFRetain(this._gradient);
            }
        }
        return this._gradient;
    }
    release() {
        if (this._gradient) {
            CFRelease(this._gradient);
            this._gradient = undefined;
        }
    }
}
