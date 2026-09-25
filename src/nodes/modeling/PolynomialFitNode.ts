import { BaseNode } from '@tracereactive/types';
import { ModelingCategory } from '../../categories';
import * as aq from 'arquero';
import { PolynomialRegression } from 'ml-regression';

export class PolynomialFitNode extends BaseNode {
    readonly category = ModelingCategory;
    readonly typeId = 'stats:polynomial_fit';
    readonly displayName = 'Polynomial Fit';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'Fitted Data', outputType: 'core:dataframe' },
        { name: 'R-Squared', outputType: 'core:number' },
        { name: 'Model', outputType: 'core:data' }
    ];
    
    readonly properties = [
        { name: 'target', label: 'Target (Y)', type: 'text' as const, defaultValue: '' },
        { name: 'feature', label: 'Feature (X)', type: 'text' as const, defaultValue: '' },
        { name: 'degree', label: 'Degree', type: 'number' as const, defaultValue: 2 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const target = properties['target'] as string;
        const feature = properties['feature'] as string;
        let degree = Number(properties['degree']);
        if (isNaN(degree) || degree < 1) degree = 2;
        
        if (!target || !feature || !table.columnNames().includes(target) || !table.columnNames().includes(feature)) return {};
        
        const x: number[] = [];
        const y: number[] = [];
        
        const numRows = table.numRows();
        for (let r = 0; r < numRows; r++) {
            const xVal = Number(table.get(feature, r));
            const yVal = Number(table.get(target, r));
            
            if (!isNaN(xVal) && !isNaN(yVal)) {
                x.push(xVal);
                y.push(yVal);
            }
        }
        
        if (x.length < 2) return {};

        try {
            const poly = new PolynomialRegression(x, y, degree);
            const coefs = poly.coefficients;
            
            const summaryRows = [];
            for (let i = 0; i < coefs.length; i++) {
                summaryRows.push({ Term: `x^${i}`, Estimate: coefs[i] });
            }
            
            const predictions = poly.predict(x);
            const residuals = y.map((yi, idx) => yi - predictions[idx]);
            
            const fittedObj = {
                [feature]: x,
                [target]: y,
                'y_pred': predictions,
                'residual': residuals
            };
            
            let sumY = 0;
            for (let i = 0; i < y.length; i++) sumY += y[i];
            const meanY = sumY / y.length;
            
            let ssTot = 0;
            let ssRes = 0;
            for (let i = 0; i < y.length; i++) {
                ssTot += Math.pow(y[i] - meanY, 2);
                ssRes += Math.pow(residuals[i], 2);
            }
            const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
            
            return {
                Summary: aq.from(summaryRows),
                'Fitted Data': aq.table(fittedObj),
                'R-Squared': r2,
                Model: { type: 'ml-polynomial', data: poly.toJSON(), feature, target }
            };
        } catch(e) {
            console.error(e);
            return {};
        }
    }
}
