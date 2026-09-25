import { BaseNode } from '@tracereactive/types';
import { ModelingCategory } from '../../categories';
import * as aq from 'arquero';
import { MultivariateLinearRegression as MLR } from 'ml-regression';

export class LinearRegressionNode extends BaseNode {
    readonly category = ModelingCategory;
    readonly typeId = 'stats:linear_regression';
    readonly displayName = 'Linear Regression (OLS)';
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
        { name: 'target', label: 'Target Column', type: 'text' as const, defaultValue: '' },
        { name: 'features', label: 'Feature Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'fitIntercept', label: 'Fit Intercept', type: 'boolean' as const, defaultValue: true }
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
        const featureStr = properties['features'] as string;
        const fitIntercept = properties['fitIntercept'] !== false;

        if (!target || !featureStr || !table.columnNames().includes(target)) return {};
        
        const features = featureStr.split(',').map(f => f.trim()).filter(f => table.columnNames().includes(f));
        if (features.length === 0) return {};
        
        const X: number[][] = [];
        const y: number[][] = [];
        
        const numRows = table.numRows();
        for (let r = 0; r < numRows; r++) {
            let rowX = [];
            let isValid = true;
            for (const f of features) {
                const val = Number(table.get(f, r));
                if (isNaN(val)) isValid = false;
                rowX.push(val);
            }
            const yVal = Number(table.get(target, r));
            if (isNaN(yVal)) isValid = false;
            
            if (isValid) {
                X.push(rowX);
                y.push([yVal]);
            }
        }
        
        if (X.length < 2) return {};

        try {
            const mlr = new MLR(X, y, { intercept: fitIntercept });
            const modelJson = mlr.toJSON();
            const coefs = modelJson.weights || mlr.weights;
            
            const summaryRows = [];
            for(let i=0; i<features.length; i++) {
                summaryRows.push({ Term: features[i], Estimate: coefs[i][0] });
            }
            if (fitIntercept && coefs.length > features.length) {
                summaryRows.push({ Term: 'Intercept', Estimate: coefs[coefs.length-1][0] });
            }
            
            const predictions = mlr.predict(X);
            const residuals = [];
            for (let i = 0; i < y.length; i++) {
                residuals.push(y[i][0] - predictions[i][0]);
            }
            
            const fittedObj: Record<string, number[]> = {};
            for (let i = 0; i < features.length; i++) {
                fittedObj[features[i]] = X.map(r => r[i]);
            }
            fittedObj[target] = y.map(r => r[0]);
            fittedObj['y_pred'] = predictions.map((r: any) => r[0]);
            fittedObj['residual'] = residuals;
            
            let sumY = 0;
            for (let i = 0; i < y.length; i++) sumY += y[i][0];
            const meanY = sumY / y.length;
            
            let ssTot = 0;
            let ssRes = 0;
            for (let i = 0; i < y.length; i++) {
                ssTot += Math.pow(y[i][0] - meanY, 2);
                ssRes += Math.pow(residuals[i], 2);
            }
            const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
            
            return {
                Summary: aq.from(summaryRows),
                'Fitted Data': aq.table(fittedObj),
                'R-Squared': r2,
                Model: { type: 'ml-regression-mlr', data: modelJson, features: features, target: target }
            };
        } catch(e) {
            console.error(e);
            return {};
        }
    }
}
