import { BaseNode } from '@tracereactive/types';
import { TransformsCategory } from '../../categories';
import * as aq from 'arquero';

export class BoxCoxTransformNode extends BaseNode {
    readonly category = TransformsCategory;
    readonly typeId = 'stats:boxcox';
    readonly displayName = 'Box-Cox Transform';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Data', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'lambda', label: 'Lambda (0 for log)', type: 'number' as const, defaultValue: 0 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        let cols = (properties['columns'] as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length === 0) {
            cols = table.columnNames().filter(c => typeof table.get(c, 0) === 'number');
        }
        
        let lambda = Number(properties['lambda']);
        if (isNaN(lambda)) lambda = 0;
        
        const derivations: Record<string, any> = {};
        
        for (const col of cols) {
            if (lambda === 0) {
                derivations[col] = aq.escape((d: any) => {
                    const v = d[col];
                    if (typeof v !== 'number' || v <= 0) return null;
                    return Math.log(v);
                });
            } else {
                derivations[col] = aq.escape((d: any) => {
                    const v = d[col];
                    if (typeof v !== 'number' || v <= 0) return null;
                    return (Math.pow(v, lambda) - 1) / lambda;
                });
            }
        }
        
        return { Data: table.derive(derivations) };
    }
}
