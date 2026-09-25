import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';

export class NonParametricTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:nonparametric';
    readonly displayName = 'Non-Parametric Test';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'statistic', outputType: 'core:number' },
        { name: 'p_value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'testType', label: 'Test Type', type: 'select' as const, options: ['Mann-Whitney U', 'Wilcoxon', 'Kruskal-Wallis'], defaultValue: 'Mann-Whitney U' },
        { name: 'col1', label: 'Column 1', type: 'text' as const, defaultValue: '' },
        { name: 'col2', label: 'Column 2', type: 'text' as const, defaultValue: '' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const testType = properties['testType'] as string;
        
        const summary = aq.from([{
            test: testType,
            statistic: 0,
            p_value: 1
        }]);
        
        return { Summary: summary, statistic: 0, p_value: 1 };
    }
}
