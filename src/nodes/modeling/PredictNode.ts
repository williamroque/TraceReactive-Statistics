import { BaseNode } from '@tracereactive/types';
import { ModelingCategory } from '../../categories';
import * as aq from 'arquero';
import { MultivariateLinearRegression, PolynomialRegression } from 'ml-regression';

export class PredictNode extends BaseNode {
    readonly category = ModelingCategory;
    readonly typeId = 'stats:predict';
    readonly displayName = 'Predict (Evaluate Model)';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Model', acceptsType: 'core:data' },
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Predictions', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'outputCol', label: 'Output Column Name', type: 'string' as const, defaultValue: 'y_pred' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        const model = inputs['Model'];
        
        if (!table || !model || !model.type) return {};
        
        const outCol = properties['outputCol'] || 'y_pred';
        
        if (model.type === 'ml-regression-mlr') {
            const features = model.features as string[];
            
            const cols = table.columnNames();
            for (const f of features) {
                if (!cols.includes(f)) return {};
            }
            
            const X: number[][] = [];
            const numRows = table.numRows();
            for (let r = 0; r < numRows; r++) {
                let rowX = [];
                for (const f of features) {
                    rowX.push(Number(table.get(f, r)) || 0);
                }
                X.push(rowX);
            }
            
            const mlr = MultivariateLinearRegression.load(model.data);
            const preds = mlr.predict(X);
            
            return {
                Predictions: table.assign({ [outCol]: preds.map((p: any) => p[0]) })
            };
        }
        else if (model.type === 'ml-polynomial') {
            const feature = model.feature;
            
            if (!table.columnNames().includes(feature)) return {};
            
            const X: number[] = [];
            const numRows = table.numRows();
            for (let r = 0; r < numRows; r++) {
                X.push(Number(table.get(feature, r)) || 0);
            }
            
            const poly = PolynomialRegression.load(model.data);
            const preds = poly.predict(X);
            
            return {
                Predictions: table.assign({ [outCol]: preds })
            };
        }
        else if (model.type === 'logistic-gd') {
            const features = model.features as string[];
            const weights = model.weights as number[];
            const labelMap = model.labelMap as Record<string, number>;
            const thresh = Number(model.threshold) || 0.5;
            const uniqueLabels = Object.entries(labelMap).sort((a, b) => a[1] - b[1]).map(e => e[0]);

            const cols = table.columnNames();
            for (const f of features) {
                if (!cols.includes(f)) return {};
            }

            const numRows = table.numRows();
            const probs: number[] = [];
            const predicted: number[] = [];

            for (let r = 0; r < numRows; r++) {
                let z = weights[0];
                for (let i = 0; i < features.length; i++) {
                    z += Number(table.get(features[i], r) || 0) * weights[i + 1];
                }
                const p = 1 / (1 + Math.exp(-z));
                probs.push(p);
                predicted.push(p >= thresh ? 1 : 0);
            }

            return {
                Predictions: table.assign({
                    [outCol]: predicted.map(v => uniqueLabels[v]),
                    probability: probs
                })
            };
        }
        
        return { Predictions: table };
    }
}
