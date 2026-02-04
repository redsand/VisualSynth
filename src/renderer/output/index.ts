/**
 * Output Integration Module
 *
 * Provides unified access to Spout and NDI output integrations
 * for VJ and streaming workflows.
 */

export { createSpoutExporter, type SpoutExporter } from './spoutExporter';
export { createNdiSender, type NdiSender } from './ndiSender';
export { createOutputManager, type OutputManager } from './outputManager';
