import { BaseNode } from '@tracereactive/types';
import { ModelingCategory } from '../../categories';
import * as aq from 'arquero';

export class LogisticRegressionNode extends BaseNode {
    readonly category = ModelingCategory;
    readonly typeId = 'stats:logistic_regression';
    readonly displayName = 'Logistic Regression';
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
        { name: 'threshold', label: 'Threshold', type: 'number' as const, defaultValue: 0.5 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};
        
        return {
            Summary: aq.table({}),
            'Fitted Data': aq.table({}),
            Model: { type: 'logistic', features: properties['features'], target: properties['target'] }
        };
    }
}
