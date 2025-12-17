const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const NOTEBOOK_NAVIGATOR_SVG_FILTERS_ID = 'notebook-navigator-svg-filters';
const NOTEBOOK_NAVIGATOR_FROSTED_FILTER_ID = 'notebook-navigator-frosted';

function createSvgElement(tagName: string) {
    return document.createElementNS(SVG_NAMESPACE, tagName);
}

function ensureFilterDefs(svg: SVGSVGElement) {
    const defsElement = createSvgElement('defs');
    if (!(defsElement instanceof SVGDefsElement)) {
        return;
    }

    const filterElement = createSvgElement('filter');
    if (!(filterElement instanceof SVGFilterElement)) {
        return;
    }
    const filter = filterElement;
    filter.setAttribute('id', NOTEBOOK_NAVIGATOR_FROSTED_FILTER_ID);
    filter.setAttribute('x', '-20%');
    filter.setAttribute('y', '-20%');
    filter.setAttribute('width', '140%');
    filter.setAttribute('height', '140%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const blurElement = createSvgElement('feGaussianBlur');
    if (!(blurElement instanceof SVGFEGaussianBlurElement)) {
        return;
    }
    const blur = blurElement;
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '8');
    blur.setAttribute('result', 'blurred');

    const turbulenceElement = createSvgElement('feTurbulence');
    if (!(turbulenceElement instanceof SVGFETurbulenceElement)) {
        return;
    }
    const turbulence = turbulenceElement;
    turbulence.setAttribute('type', 'fractalNoise');
    turbulence.setAttribute('baseFrequency', '0.015');
    turbulence.setAttribute('numOctaves', '2');
    turbulence.setAttribute('seed', '2');
    turbulence.setAttribute('result', 'noise');

    const displacementElement = createSvgElement('feDisplacementMap');
    if (!(displacementElement instanceof SVGFEDisplacementMapElement)) {
        return;
    }
    const displacement = displacementElement;
    displacement.setAttribute('in', 'blurred');
    displacement.setAttribute('in2', 'noise');
    displacement.setAttribute('scale', '25');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    displacement.setAttribute('result', 'displaced');

    const finishBlurElement = createSvgElement('feGaussianBlur');
    if (!(finishBlurElement instanceof SVGFEGaussianBlurElement)) {
        return;
    }
    const finishBlur = finishBlurElement;
    finishBlur.setAttribute('in', 'displaced');
    finishBlur.setAttribute('stdDeviation', '1.5');

    filter.append(blur, turbulence, displacement, finishBlur);
    defsElement.append(filter);
    svg.append(defsElement);
}

export function ensureNotebookNavigatorSvgFilters() {
    if (document.getElementById(NOTEBOOK_NAVIGATOR_SVG_FILTERS_ID)) {
        return;
    }

    const svgElement = createSvgElement('svg');
    if (!(svgElement instanceof SVGSVGElement)) {
        return;
    }
    const svg = svgElement;
    svg.setAttribute('id', NOTEBOOK_NAVIGATOR_SVG_FILTERS_ID);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('nn-svg-filters');

    ensureFilterDefs(svg);
    document.body.append(svg);
}
