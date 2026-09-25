import type { TraceReactiveAPI } from '@tracereactive/types';
import * as aq from 'arquero';

import { DescribeExtendedNode } from './nodes/descriptive/DescribeExtendedNode';
import { CorrelationNode } from './nodes/descriptive/CorrelationNode';
import { CrossTabNode } from './nodes/descriptive/CrossTabNode';
import { QuantilesNode } from './nodes/descriptive/QuantilesNode';
import { NormalizeNode } from './nodes/transforms/NormalizeNode';
import { OutlierDetectionNode } from './nodes/transforms/OutlierDetectionNode';
import { BoxCoxTransformNode } from './nodes/transforms/BoxCoxTransformNode';
import { RollingStatsNode } from './nodes/timeseries/RollingStatsNode';
import { AutocorrelationNode } from './nodes/timeseries/AutocorrelationNode';
import { DifferencingNode } from './nodes/timeseries/DifferencingNode';
import { TTestNode } from './nodes/inferential/TTestNode';
import { AnovaNode } from './nodes/inferential/AnovaNode';
import { ChiSquareTestNode } from './nodes/inferential/ChiSquareTestNode';
import { NormalityTestNode } from './nodes/inferential/NormalityTestNode';
import { NonParametricTestNode } from './nodes/inferential/NonParametricTestNode';
import { LinearRegressionNode } from './nodes/modeling/LinearRegressionNode';
import { LogisticRegressionNode } from './nodes/modeling/LogisticRegressionNode';
import { PolynomialFitNode } from './nodes/modeling/PolynomialFitNode';
import { PredictNode } from './nodes/modeling/PredictNode';
import { SampleDistributionNode } from './nodes/distributions/SampleDistributionNode';
import { FitDistributionNode } from './nodes/distributions/FitDistributionNode';
import { ProbabilityCalculatorNode } from './nodes/distributions/ProbabilityCalculatorNode';

declare const traceReactive: TraceReactiveAPI;

const nodes: any[] = [
    new DescribeExtendedNode(),
    new CorrelationNode(),
    new CrossTabNode(),
    new QuantilesNode(),
    new NormalizeNode(),
    new OutlierDetectionNode(),
    new BoxCoxTransformNode(),
    new RollingStatsNode(),
    new AutocorrelationNode(),
    new DifferencingNode(),
    new TTestNode(),
    new AnovaNode(),
    new ChiSquareTestNode(),
    new NormalityTestNode(),
    new NonParametricTestNode(),
    new LinearRegressionNode(),
    new LogisticRegressionNode(),
    new PolynomialFitNode(),
    new PredictNode(),
    new SampleDistributionNode(),
    new FitDistributionNode(),
    new ProbabilityCalculatorNode()
];

const serializableNodes = nodes.map(n => ({
    typeId: n.typeId,
    displayName: n.displayName,
    category: n.category,
    nodeInterface: n.nodeInterface,
    visible: n.visible,
    inputs: n.inputs,
    outputs: n.outputs,
    properties: n.properties,
    dynamicInputs: n.dynamicInputs,
    dynamicOutputs: n.dynamicOutputs
}));

traceReactive.registerNodes(serializableNodes);

traceReactive.onEvaluateNode(async ({ typeId, inputs, properties }: any) => {
    const node = nodes.find(n => n.typeId === typeId);
    if (!node) {
        throw new Error(`Unknown node type: ${typeId}`);
    }

    const deserialize = (obj: any): any => {
        if (!obj) return obj;
        if (obj.__arqueroData) {
            return aq.from(obj.__arqueroData);
        }
        if (Array.isArray(obj)) return obj.map(deserialize);
        if (typeof obj === 'object') {
            const res: any = {};
            for (const k in obj) res[k] = deserialize(obj[k]);
            return res;
        }
        return obj;
    };

    const serialize = (obj: any): any => {
        if (!obj) return obj;
        // Duck-type check for Arquero table
        if (typeof obj.numRows === 'function' && typeof obj.columnNames === 'function') {
            return { __arqueroData: obj.objects() };
        }
        if (Array.isArray(obj)) return obj.map(serialize);
        if (typeof obj === 'object') {
            const res: any = {};
            for (const k in obj) res[k] = serialize(obj[k]);
            return res;
        }
        return obj;
    };

    const parsedInputs = deserialize(inputs);
    const result = await node.evaluate(parsedInputs, properties);
    return serialize(result);
});
