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
        { name: 'Model', outputType: 'core:data' }
    ];
    
    readonly properties = [
        { name: 'target', label: 'Target Column', type: 'text' as const, defaultValue: '' },
        { name: 'features', label: 'Feature Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'fitIntercept', label: 'Fit Intercept', type: 'boolean' as const, defaultValue: true }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
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
                summaryRows.push({ term: features[i], estimate: coefs[i][0] });
            }
            if (fitIntercept && coefs.length > features.length) {
                summaryRows.push({ term: 'Intercept', estimate: coefs[coefs.length-1][0] });
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
            
            return {
                Summary: aq.from(summaryRows),
                'Fitted Data': aq.from(fittedObj),
                Model: { type: 'ml-regression-mlr', data: modelJson, features: features, target: target }
            };
        } catch(e) {
            console.error(e);
            return {};
        }
    }
}
