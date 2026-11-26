// Compresses a model for the web after the Blender export (docs/development.md): its vertex and
// index data packed with meshoptimizer (EXT_meshopt_compression), the normals stored as 8-bit
// integers (KHR_mesh_quantization). Positions and texture coordinates stay 32-bit floats: the
// nodes keep their transforms (quantizing positions would rescale the nodes the rig turns and
// slides) and the acceptance checks measure the same geometry Blender built; it costs about a
// tenth more download than quantizing them too. The page and the tests decode the file with
// three.js's meshopt decoder.
//
//   node tools/compress-model.mjs in.glb out.glb   (in and out may be the same file)

import { Logger, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) throw new Error("usage: node tools/compress-model.mjs in.glb out.glb");

await MeshoptEncoder.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.ERROR))
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
await doc.transform(reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ pattern: /^NORMAL$/, quantizeNormal: 8 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(dst, doc);
