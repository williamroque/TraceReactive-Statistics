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
        { name: 'outputCol', label: 'Output Column Name', type: 'text' as const, defaultValue: 'y_pred' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        const model = inputs['Model'];
        
        if (!table || !model || !model.type) return {};
        
        const outCol = properties['outputCol'] || 'y_pred';
        
        if (model.type === 'ml-regression-mlr') {
            const features = model.features as string[];
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
        
        return { Predictions: table };
    }
}
