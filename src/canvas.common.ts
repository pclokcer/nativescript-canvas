import { Canvas, Cap, DashPathEffect, Join, Rect, RectF, Style } from './canvas';
import { Property } from '@nativescript/core/ui/core/properties';
import { Color } from '@nativescript/core/color';
import { Length } from '@nativescript/core/ui/styling/style-properties';
import { booleanConverter, layout, View, Observable } from '@nativescript/core/ui/core/view';
import { ObservableArray, ChangedData } from '@nativescript/core/data/observable-array/observable-array';
import { screen } from '@nativescript/core/platform';
import Shape from './shapes/shape';

declare module '@nativescript/core/ui/core/view' {
    interface View {
        _raiseLayoutChangedEvent();
        _onSizeChanged();
    }
}

export function createRect(x: number, y: number, w: number, h: number) {
    return new Rect(x, y, x + w, y + h);
}

export function createRectF(x: number, y: number, w: number, h: number) {
    return new RectF(x, y, x + w, y + h);
}

export const cachedProperty = new Property<CanvasBase, boolean>({ name: 'cached', defaultValue: false, valueConverter: booleanConverter });
export const hardwareAcceleratedProperty = new Property<CanvasBase, boolean>({ name: 'hardwareAccelerated', defaultValue: true, valueConverter: booleanConverter });
export const densityProperty = new Property<CanvasBase, number>({ name: 'density', valueConverter: parseFloat });

function throttle(fn, limit) {
    let waiting = false;
    return (...args) => {
        if (!waiting) {
            fn.apply(this, args);
            waiting = true;
            setTimeout(() => {
                waiting = false;
            }, limit);
        }
    };
}
export const DEFAULT_SCALE = screen.mainScreen.scale;
export abstract class CanvasBase extends View {
    protected _shapes: ObservableArray<Shape>;

    get shapes() {
        return this._shapes;
    }
    public cached = false;
    public density = DEFAULT_SCALE;

    drawFameRate = false;

    getOrCreateShapes() {
        if (!this._shapes) {
            this._shapes = new ObservableArray<Shape>();
            this._shapes.addEventListener(ObservableArray.changeEvent, this.onShapesCollectionChanged, this);
        }
        return this._shapes;
    }

    requestDrawShapes() {
        if (this.cached) {
            this.drawShapes();
        } else {
            this.redraw();
        }
    }
    requestDrawShapesThrottled = throttle(() => this.requestDrawShapes(), 5);
    // throttling prevent too fast drawing on multiple properties change
    _onShapesContentsChanged() {
        if (this.nativeViewProtected) {
            if (this.cached) {
                this.requestDrawShapesThrottled();
            } else {
                this.requestDrawShapes();
            }
        }
    }
    public toString(): string {
        let result = super.toString();
        if (this._shapes) {
            for (let i = 0, length = this._shapes.length; i < length; i++) {
                result += this._shapes.getItem(i).toString();
            }
        }

        return result;
    }

    public addShape(shape: Shape) {
        this.getOrCreateShapes().push(shape);
    }
    
    public removeShape(shape: Shape) {
        if (this._shapes) {
            const index = this._shapes.indexOf(shape);
            if (index !== -1) {
                this._shapes.splice(index, 1);
            }
        }
    }

    public _addArrayFromBuilder(name: string, value: any[]) {
        value.forEach((v) => {
            this._addChildFromBuilder(null, value);
        });
        // we ignore any other kind of view.
    }

    public _addChildFromBuilder(name: string, value: any): void {
        if (value instanceof Shape) {
            this.addShape(value);
        }
        // we ignore any other kind of view.
    }
    public _removeView(view: any) {
        if (view instanceof Shape) {
            this.removeShape(view);
        }
    }

    private onShapesCollectionChanged(eventData: ChangedData<Shape>) {
        if (eventData.addedCount > 0) {
            for (let i = 0; i < eventData.addedCount; i++) {
                const shape = (eventData.object as ObservableArray<Shape>).getItem(eventData.index + i);
                // Then attach handlers - we skip the first nofitication because
                // we raise change for the whole instance.
                shape._parent = new WeakRef(this as any);
                this.addPropertyChangeHandler(shape);
            }
        }

        if (eventData.removed && eventData.removed.length > 0) {
            for (let p = 0; p < eventData.removed.length; p++) {
                const shape = eventData.removed[p];
                // First remove handlers so that we don't listen for changes
                // on inherited properties.
                this.removePropertyChangeHandler(shape);
                shape._parent = null;
                this.redraw();
            }
        }
    }
    public onSizeChanged(w: number, h: number, oldw: number, oldh: number) {
        if (!!this._shapes && this._shapes.length > 0) {
            this.requestDrawShapes();
        }
    }
    onShapePropertyChange() {
        this.requestDrawShapes();
    }
    private addPropertyChangeHandler(shape: Shape) {
        // const style = shape.style;
        shape.on(Observable.propertyChangeEvent, this.onShapePropertyChange, this);
    }
    private removePropertyChangeHandler(shape: Shape) {
        shape.off(Observable.propertyChangeEvent, this.onShapePropertyChange, this);
    }

    [densityProperty.setNative](value) {
        if (!!this._shapes) {
            this.requestDrawShapes();
        }
    }
    shapesCanvas: Canvas;
    drawShapes() {
        const width = layout.toDeviceIndependentPixels(this.getMeasuredWidth());
        const height = layout.toDeviceIndependentPixels(this.getMeasuredHeight());
        if (this.shapesCanvas) {
            // this.shapesCanvas.release();
            this.shapesCanvas = null;
        }
        if (this._shapes && this._shapes.length > 0 && width > 0 && height > 0) {
            const canvas = (this.shapesCanvas = new Canvas(width, height));
            canvas.setDensity(this.density);
            this._shapes.forEach((s) => s.drawMyShapeOnCanvas(canvas, this as any));
            this.redraw();
        }
    }
    invalidate() {
        this.redraw(); 
    }
    abstract redraw();
    protected abstract onDraw(canvas: Canvas);
}

cachedProperty.register(CanvasBase);
hardwareAcceleratedProperty.register(CanvasBase);
densityProperty.register(CanvasBase);
