Shader source (numbered):
 0001: #version 300 es
0002: precision highp float;
0003: 
0004: uniform float uTime;
0005: uniform float uAspect;
0006: uniform float uRms;
0007: uniform float uPeak;
0008: uniform float uStrobe;
0009: uniform float uPlasmaEnabled;
0010: uniform float uSpectrumEnabled;
0011: uniform float uOrigamiEnabled;
0012: uniform float uGlyphEnabled;
0013: uniform float uGlyphOpacity;
0014: uniform float uGlyphMode;
0015: uniform float uGlyphSeed;
0016: uniform float uGlyphBeat;
0017: uniform float uGlyphSpeed;
0018: uniform float uCrystalEnabled;
0019: uniform float uCrystalOpacity;
0020: uniform float uCrystalMode;
0021: uniform float uCrystalBrittleness;
0022: uniform float uCrystalScale;
0023: uniform float uCrystalSpeed;
0024: uniform float uInkEnabled;
0025: uniform float uInkOpacity;
0026: uniform float uInkBrush;
0027: uniform float uInkPressure;
0028: uniform float uInkLifespan;
0029: uniform float uInkSpeed;
0030: uniform float uInkScale;
0031: uniform float uTopoEnabled;
0032: uniform float uTopoOpacity;
0033: uniform float uTopoQuake;
0034: uniform float uTopoSlide;
0035: uniform float uTopoPlate;
0036: uniform float uTopoTravel;
0037: uniform float uTopoScale;
0038: uniform float uTopoElevation;
0039: uniform float uWeatherEnabled;
0040: uniform float uWeatherOpacity;
0041: uniform float uWeatherMode;
0042: uniform float uWeatherIntensity;
0043: uniform float uWeatherSpeed;
0044: uniform float uPortalEnabled;
0045: uniform float uPortalOpacity;
0046: uniform float uPortalShift;
0047: uniform float uPortalStyle;
0048: uniform vec2 uPortalPos[4];
0049: uniform float uPortalRadius[4];
0050: uniform float uPortalActive[4];
0051: uniform float uOscilloEnabled;
0052: uniform float uOscilloOpacity;
0053: uniform float uOscilloMode;
0054: uniform float uOscilloFreeze;
0055: uniform float uOscilloRotate;
0056: uniform float uOscillo[256];
0057: uniform vec2 uGravityPos[8];
0058: uniform float uGravityStrength[8];
0059: uniform float uGravityPolarity[8];
0060: uniform float uGravityActive[8];
0061: uniform float uGravityCollapse;
0062: uniform float uSpectrum[64];
0063: uniform float uContrast;
0064: uniform float uSaturation;
0065: uniform float uPaletteShift;
0066: uniform vec3 uPalette[5];
0067: uniform float uPlasmaOpacity;
0068: uniform float uPlasmaSpeed;
0069: uniform float uPlasmaScale;
0070: uniform float uPlasmaComplexity;
0071: uniform float uPlasmaAudioReact;
0072: uniform float uSpectrumOpacity;
0073: uniform float uOrigamiOpacity;
0074: uniform float uOrigamiFoldState;
0075: uniform float uOrigamiFoldSharpness;
0076: uniform float uOrigamiSpeed;
0077: uniform float uEffectsEnabled;
0078: uniform float uBloom;
0079: uniform float uBlur;
0080: uniform float uChroma;
0081: uniform float uPosterize;
0082: uniform float uKaleidoscope;
0083: uniform float uKaleidoscopeRotation;
0084: uniform float uFeedback;
0085: uniform float uFeedbackZoom;
0086: uniform float uFeedbackRotation;
0087: uniform float uPersistence;
0088: uniform float uTrailSpectrum[64];
0089: uniform float uExpressiveEnergyBloom;
0090: uniform float uExpressiveEnergyThreshold;
0091: uniform float uExpressiveEnergyAccumulation;
0092: uniform float uExpressiveRadialGravity;
0093: uniform float uExpressiveRadialStrength;
0094: uniform float uExpressiveRadialRadius;
0095: uniform float uExpressiveRadialFocusX;
0096: uniform float uExpressiveRadialFocusY;
0097: uniform float uExpressiveMotionEcho;
0098: uniform float uExpressiveMotionEchoDecay;
0099: uniform float uExpressiveMotionEchoWarp;
0100: uniform float uExpressiveSpectralSmear;
0101: uniform float uExpressiveSpectralOffset;
0102: uniform float uExpressiveSpectralMix;
0103: uniform float uParticlesEnabled;
0104: uniform float uParticleDensity;
0105: uniform float uParticleSpeed;
0106: uniform float uParticleSize;
0107: uniform float uParticleGlow;
0108: uniform float uParticleTurbulence;
0109: uniform float uParticleAudioLift;
0110: uniform float uSdfEnabled;
0111: uniform float uSdfShape;
0112: uniform float uSdfScale;
0113: uniform float uSdfEdge;
0114: uniform float uSdfGlow;
0115: uniform float uSdfRotation;
0116: uniform float uSdfFill;
0117: uniform vec3 uSdfColor;
0118: uniform float uPlasmaAssetEnabled;
0119: uniform sampler2D uPlasmaAsset;
0120: uniform float uPlasmaAssetBlend;
0121: uniform float uPlasmaAssetAudioReact;
0122: uniform float uSpectrumAssetEnabled;
0123: uniform sampler2D uSpectrumAsset;
0124: uniform float uSpectrumAssetBlend;
0125: uniform float uSpectrumAssetAudioReact;
0126: uniform float uMediaEnabled;
0127: uniform float uMediaOpacity;
0128: uniform float uMediaAssetEnabled;
0129: uniform sampler2D uMediaAsset;
0130: uniform float uMediaAssetBlend;
0131: uniform float uMediaAssetAudioReact;
0132: uniform vec2 uMediaBurstPos[8];
0133: uniform float uMediaBurstRadius[8];
0134: uniform float uMediaBurstType[8];
0135: uniform float uMediaBurstActive[8];
0136: uniform sampler2D uWaveformTex;
0137: uniform sampler2D uSpectrumTex;
0138: uniform sampler2D uModulatorTex;
0139: uniform sampler2D uMidiTex;
0140: uniform float uWaveformEnabled;
0141: uniform float uSpectrumEnabledInternal;
0142: uniform float uModulatorsEnabled;
0143: uniform float uMidiEnabled;
0144: uniform vec3 uGlobalColor;
0145: uniform float uDebugTint;
0146: uniform vec3 uRoleWeights; // x: core, y: support, z: atmosphere
0147: uniform float uTransitionAmount;
0148: uniform float uTransitionType;
0149: uniform float uChemistryMode;
0150: uniform float uMotionTemplate;
0151: uniform float uEngineMass;
0152: uniform float uEngineFriction;
0153: uniform float uEngineElasticity;
0154: uniform float uMaxBloom;
0155: uniform float uForceFeedback;
0156: uniform float uEngineGrain;
0157: uniform float uEngineVignette;
0158: uniform float uEngineCA;
0159: uniform float uEngineSignature;
0160: 
0161: // --- EDM Generators ---
0162: uniform float uLaserEnabled;
0163: uniform float uLaserOpacity;
0164: uniform float uLaserBeamCount;
0165: uniform float uLaserBeamWidth;
0166: uniform float uLaserBeamLength;
0167: uniform float uLaserRotation;
0168: uniform float uLaserRotationSpeed;
0169: uniform float uLaserSpread;
0170: uniform float uLaserMode;
0171: uniform float uLaserColorShift;
0172: uniform float uLaserAudioReact;
0173: uniform float uLaserGlow;
0174: uniform float uStrobeEnabled;
0175: uniform float uStrobeOpacity;
0176: uniform float uStrobeRate;
0177: uniform float uStrobeDutyCycle;
0178: uniform float uStrobeMode;
0179: uniform float uStrobeAudioTrigger;
0180: uniform float uStrobeThreshold;
0181: uniform float uStrobeFadeOut;
0182: uniform float uStrobePattern;
0183: uniform float uShapeBurstEnabled;
0184: uniform float uShapeBurstOpacity;
0185: uniform float uShapeBurstShape;
0186: uniform float uShapeBurstExpandSpeed;
0187: uniform float uShapeBurstStartSize;
0188: uniform float uShapeBurstMaxSize;
0189: uniform float uShapeBurstThickness;
0190: uniform float uShapeBurstFadeMode;
0191: uniform float uBurstSpawnTimes[8];
0192: uniform float uBurstActives[8];
0193: uniform float uGridTunnelEnabled;
0194: uniform float uGridTunnelOpacity;
0195: uniform float uGridTunnelSpeed;
0196: uniform float uGridTunnelGridSize;
0197: uniform float uGridTunnelLineWidth;
0198: uniform float uGridTunnelPerspective;
0199: uniform float uGridTunnelHorizonY;
0200: uniform float uGridTunnelGlow;
0201: uniform float uGridTunnelAudioReact;
0202: uniform float uGridTunnelMode;
0203: 
0204: // --- Rock Generators ---
0205: uniform float uLightningEnabled;
0206: uniform float uLightningOpacity;
0207: uniform float uLightningSpeed;
0208: uniform float uLightningBranches;
0209: uniform float uLightningThickness;
0210: uniform float uLightningColor;
0211: uniform float uAnalogOscilloEnabled;
0212: uniform float uAnalogOscilloOpacity;
0213: uniform float uAnalogOscilloThickness;
0214: uniform float uAnalogOscilloGlow;
0215: uniform float uAnalogOscilloColor;
0216: uniform float uAnalogOscilloMode;
0217: uniform float uSpeakerConeEnabled;
0218: uniform float uSpeakerConeOpacity;
0219: uniform float uSpeakerConeForce;
0220: uniform float uGlitchScanlineEnabled;
0221: uniform float uGlitchScanlineOpacity;
0222: uniform float uGlitchScanlineSpeed;
0223: uniform float uGlitchScanlineCount;
0224: uniform float uLaserStarfieldEnabled;
0225: uniform float uLaserStarfieldOpacity;
0226: uniform float uLaserStarfieldSpeed;
0227: uniform float uLaserStarfieldDensity;
0228: uniform float uPulsingRibbonsEnabled;
0229: uniform float uPulsingRibbonsOpacity;
0230: uniform float uPulsingRibbonsCount;
0231: uniform float uPulsingRibbonsWidth;
0232: uniform float uElectricArcEnabled;
0233: uniform float uElectricArcOpacity;
0234: uniform float uElectricArcRadius;
0235: uniform float uElectricArcChaos;
0236: uniform float uPyroBurstEnabled;
0237: uniform float uPyroBurstOpacity;
0238: uniform float uPyroBurstForce;
0239: uniform float uGeoWireframeEnabled;
0240: uniform float uGeoWireframeOpacity;
0241: uniform float uGeoWireframeShape;
0242: uniform float uGeoWireframeScale;
0243: uniform float uSignalNoiseEnabled;
0244: uniform float uSignalNoiseOpacity;
0245: uniform float uSignalNoiseAmount;
0246: uniform float uWormholeEnabled;
0247: uniform float uWormholeOpacity;
0248: uniform float uWormholeSpeed;
0249: uniform float uWormholeWeave;
0250: uniform float uWormholeIter;
0251: uniform float uRibbonTunnelEnabled;
0252: uniform float uRibbonTunnelOpacity;
0253: uniform float uRibbonTunnelSpeed;
0254: uniform float uRibbonTunnelTwist;
0255: uniform float uFractalTunnelEnabled;
0256: uniform float uFractalTunnelOpacity;
0257: uniform float uFractalTunnelSpeed;
0258: uniform float uFractalTunnelComplexity;
0259: uniform float uCircuitConduitEnabled;
0260: uniform float uCircuitConduitOpacity;
0261: uniform float uCircuitConduitSpeed;
0262: uniform float uAuraPortalEnabled;
0263: uniform float uAuraPortalOpacity;
0264: uniform float uAuraPortalColor;
0265: uniform float uFreqTerrainEnabled;
0266: uniform float uFreqTerrainOpacity;
0267: uniform float uFreqTerrainScale;
0268: uniform float uDataStreamEnabled;
0269: uniform float uDataStreamOpacity;
0270: uniform float uDataStreamSpeed;
0271: uniform float uCausticLiquidEnabled;
0272: uniform float uCausticLiquidOpacity;
0273: uniform float uCausticLiquidSpeed;
0274: uniform float uShimmerVeilEnabled;
0275: uniform float uShimmerVeilOpacity;
0276: uniform float uShimmerVeilComplexity;
0277: 
0278: // --- New 31 Generators ---
0279: uniform float uNebulaCloudEnabled;
0280: uniform float uNebulaCloudOpacity;
0281: uniform float uNebulaCloudDensity;
0282: uniform float uNebulaCloudSpeed;
0283: uniform float uCircuitBoardEnabled;
0284: uniform float uCircuitBoardOpacity;
0285: uniform float uCircuitBoardGrowth;
0286: uniform float uCircuitBoardComplexity;
0287: uniform float uLorenzAttractorEnabled;
0288: uniform float uLorenzAttractorOpacity;
0289: uniform float uLorenzAttractorSpeed;
0290: uniform float uLorenzAttractorChaos;
0291: uniform float uMandalaSpinnerEnabled;
0292: uniform float uMandalaSpinnerOpacity;
0293: uniform float uMandalaSpinnerSides;
0294: uniform float uMandalaSpinnerSpeed;
0295: uniform float uStarburstGalaxyEnabled;
0296: uniform float uStarburstGalaxyOpacity;
0297: uniform float uStarburstGalaxyForce;
0298: uniform float uStarburstGalaxyCount;
0299: uniform float uDigitalRainV2Enabled;
0300: uniform float uDigitalRainV2Opacity;
0301: uniform float uDigitalRainV2Speed;
0302: uniform float uDigitalRainV2Density;
0303: uniform float uLavaFlowEnabled;
0304: uniform float uLavaFlowOpacity;
0305: uniform float uLavaFlowHeat;
0306: uniform float uLavaFlowViscosity;
0307: uniform float uCrystalGrowthEnabled;
0308: uniform float uCrystalGrowthOpacity;
0309: uniform float uCrystalGrowthRate;
0310: uniform float uCrystalGrowthSharpness;
0311: uniform float uTechnoGridEnabled;
0312: uniform float uTechnoGridOpacity;
0313: uniform float uTechnoGridHeight;
0314: uniform float uTechnoGridSpeed;
0315: uniform float uMagneticFieldEnabled;
0316: uniform float uMagneticFieldOpacity;
0317: uniform float uMagneticFieldStrength;
0318: uniform float uMagneticFieldDensity;
0319: uniform float uPrismShardsEnabled;
0320: uniform float uPrismShardsOpacity;
0321: uniform float uPrismShardsRefraction;
0322: uniform float uPrismShardsCount;
0323: uniform float uNeuralNetEnabled;
0324: uniform float uNeuralNetOpacity;
0325: uniform float uNeuralNetActivity;
0326: uniform float uNeuralNetDensity;
0327: uniform float uAuroraChordEnabled;
0328: uniform float uAuroraChordOpacity;
0329: uniform float uAuroraChordWaviness;
0330: uniform float uAuroraChordColorRange;
0331: uniform float uVhsGlitchEnabled;
0332: uniform float uVhsGlitchOpacity;
0333: uniform float uVhsGlitchJitter;
0334: uniform float uVhsGlitchNoise;
0335: uniform float uMoirePatternEnabled;
0336: uniform float uMoirePatternOpacity;
0337: uniform float uMoirePatternScale;
0338: uniform float uMoirePatternSpeed;
0339: uniform float uHypercubeEnabled;
0340: uniform float uHypercubeOpacity;
0341: uniform float uHypercubeProjection;
0342: uniform float uHypercubeSpeed;
0343: uniform float uFluidSwirlEnabled;
0344: uniform float uFluidSwirlOpacity;
0345: uniform float uFluidSwirlVorticity;
0346: uniform float uFluidSwirlColorMix;
0347: uniform float uAsciiStreamEnabled;
0348: uniform float uAsciiStreamOpacity;
0349: uniform float uAsciiStreamResolution;
0350: uniform float uAsciiStreamContrast;
0351: uniform float uRetroWaveEnabled;
0352: uniform float uRetroWaveOpacity;
0353: uniform float uRetroWaveSunSize;
0354: uniform float uRetroWaveGridSpeed;
0355: uniform float uBubblePopEnabled;
0356: uniform float uBubblePopOpacity;
0357: uniform float uBubblePopPopRate;
0358: uniform float uBubblePopSize;
0359: uniform float uSoundWave3DEnabled;
0360: uniform float uSoundWave3DOpacity;
0361: uniform float uSoundWave3DAmplitude;
0362: uniform float uSoundWave3DSmoothness;
0363: uniform float uParticleVortexEnabled;
0364: uniform float uParticleVortexOpacity;
0365: uniform float uParticleVortexSuction;
0366: uniform float uParticleVortexSpin;
0367: uniform float uGlowWormsEnabled;
0368: uniform float uGlowWormsOpacity;
0369: uniform float uGlowWormsLength;
0370: uniform float uGlowWormsSpeed;
0371: uniform float uMirrorMazeEnabled;
0372: uniform float uMirrorMazeOpacity;
0373: uniform float uMirrorMazeRecursion;
0374: uniform float uMirrorMazeAngle;
0375: uniform float uPulseHeartEnabled;
0376: uniform float uPulseHeartOpacity;
0377: uniform float uPulseHeartBeats;
0378: uniform float uPulseHeartLayers;
0379: uniform float uDataShardsEnabled;
0380: uniform float uDataShardsOpacity;
0381: uniform float uDataShardsSpeed;
0382: uniform float uDataShardsSharpness;
0383: uniform float uHexCellEnabled;
0384: uniform float uHexCellOpacity;
0385: uniform float uHexCellPulse;
0386: uniform float uHexCellScale;
0387: uniform float uPlasmaBallEnabled;
0388: uniform float uPlasmaBallOpacity;
0389: uniform float uPlasmaBallVoltage;
0390: uniform float uPlasmaBallFilaments;
0391: uniform float uWarpDriveEnabled;
0392: uniform float uWarpDriveOpacity;
0393: uniform float uWarpDriveWarp;
0394: uniform float uWarpDriveGlow;
0395: uniform float uVisualFeedbackEnabled;
0396: uniform float uVisualFeedbackOpacity;
0397: uniform float uVisualFeedbackZoom;
0398: uniform float uVisualFeedbackRotation;
0399: uniform float uMyceliumGrowthEnabled;
0400: uniform float uMyceliumGrowthOpacity;
0401: uniform float uMyceliumGrowthSpread;
0402: uniform float uMyceliumGrowthDecay;
0403: 
0404: // --- Advanced SDF Injections ---
0405: uniform float uAdvancedSdfEnabled;
0406: uniform vec3 uSdfLightDir;
0407: uniform vec3 uSdfLightColor;
0408: uniform float uSdfLightIntensity;
0409: uniform float uSdfAoEnabled;
0410: uniform float uSdfShadowsEnabled;
0411: uniform float uInternalSource;
0412: uniform vec3 uCameraPos;
0413: uniform vec3 uCameraTarget;
0414: uniform float uCameraFov;
0415: 
0416: 
0417: 
0418: 
0419: float sdfSceneMap(vec3 p) {
0420:   return 10.0; // Placeholder for simple mode, overridden in advanced
0421: }
0422: 
0423: vec2 advancedSdfMap(vec3 p) {
0424:   // Default returns distance and material (0.0 for no material)
0425:   return vec2(10.0, 0.0);
0426: }
0427: 
0428: vec3 calcSdfNormal(vec3 p) {
0429:   vec2 e = vec2(0.001, 0.0);
0430:   return normalize(vec3(
0431:     advancedSdfMap(p + e.xyy).x - advancedSdfMap(p - e.xyy).x,
0432:     advancedSdfMap(p + e.yxy).x - advancedSdfMap(p - e.yxy).x,
0433:     advancedSdfMap(p + e.yyx).x - advancedSdfMap(p - e.yyx).x
0434:   ));
0435: }
0436: 
0437: vec3 getSdfColor(float id) {
0438:   return vec3(1.0);
0439: }
0440: 
0441: float calcSdfShadow(vec3 ro, vec3 rd, float k) {
0442:   float res = 1.0;
0443:   float t = 0.01;
0444:   for(int i = 0; i < 16; i++) {
0445:     float h = advancedSdfMap(ro + rd * t).x;
0446:     res = min(res, k * h / t);
0447:     t += clamp(h, 0.01, 0.2);
0448:     if(res < 0.001 || t > 5.0) break;
0449:   }
0450:   return clamp(res, 0.0, 1.0);
0451: }
0452: 
0453: float calcSdfAO(vec3 p, vec3 n) {
0454:   float occ = 0.0;
0455:   float sca = 1.0;
0456:   for(int i = 0; i < 5; i++) {
0457:     float hr = 0.01 + 0.12 * float(i) / 4.0;
0458:     float d = advancedSdfMap(p + n * hr).x;
0459:     occ += (hr - d) * sca;
0460:     sca *= 0.95;
0461:   }
0462:   return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
0463: }
0464: 
0465: mat3 setCamera(vec3 ro, vec3 ta, float cr) {
0466:   vec3 cw = normalize(ta - ro);
0467:   vec3 cp = vec3(sin(cr), cos(cr), 0.0);
0468:   vec3 cu = normalize(cross(cw, cp));
0469:   vec3 cv = normalize(cross(cu, cw));
0470:   return mat3(cu, cv, cw);
0471: }
0472: 
0473: vec3 getRayDirection(vec2 uv, vec3 ro, vec3 ta, float fov) {
0474:   mat3 ca = setCamera(ro, ta, 0.0);
0475:   return ca * normalize(vec3(uv, fov));
0476: }
0477: // --- End Injections ---
0478: 
0479: in vec2 vUv;
0480: out vec4 outColor;
0481: 
0482: vec3 blendAdd(vec3 base, vec3 blend) {
0483:   return min(base + blend, 1.0);
0484: }
0485: 
0486: vec3 blendMultiply(vec3 base, vec3 blend) {
0487:   return base * blend;
0488: }
0489: 
0490: vec3 blendScreen(vec3 base, vec3 blend) {
0491:   return 1.0 - (1.0 - base) * (1.0 - blend);
0492: }
0493: 
0494: vec3 blendOverlay(vec3 base, vec3 blend) {
0495:   return mix(
0496:     2.0 * base * blend,
0497:     1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
0498:     step(0.5, base)
0499:   );
0500: }
0501: 
0502: vec3 blendDifference(vec3 base, vec3 blend) {
0503:   return abs(base - blend);
0504: }
0505: 
0506: float sdSegment(vec2 p, vec2 a, vec2 b) {
0507:   vec2 pa = p - a;
0508:   vec2 ba = b - a;
0509:   float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
0510:   return length(pa - ba * h);
0511: }
0512: 
0513: float sdArc(vec2 p, vec2 center, float radius, float thickness) {
0514:   float d = abs(length(p - center) - radius);
0515:   return d - thickness;
0516: }
0517: 
0518: float hash21(vec2 p) {
0519:   return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
0520: }
0521: 
0522: float noise(vec2 p) {
0523:   vec2 i = floor(p);
0524:   vec2 f = fract(p);
0525:   vec2 u = f * f * (3.0 - 2.0 * f);
0526:   return mix(mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
0527:              mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
0528: }
0529: 
0530: float fbm(vec2 p) {
0531:   float v = 0.0;
0532:   float a = 0.5;
0533:   vec2 shift = vec2(100.0);
0534:   mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
0535:   for (int i = 0; i < 6; ++i) {
0536:     v += a * noise(p);
0537:     p = rot * p * 2.0 + shift;
0538:     a *= 0.5;
0539:   }
0540:   return v;
0541: }
0542: 
0543: float voronoi(vec2 x) {
0544:   vec2 n = floor(x);
0545:   vec2 f = fract(x);
0546:   float m = 8.0;
0547:   for (int j = -1; j <= 1; j++) {
0548:     for (int i = -1; i <= 1; i++) {
0549:       vec2 g = vec2(float(i), float(j));
0550:       vec2 o = vec2(hash21(n + g), hash21(n + g + 13.7));
0551:       vec2 r = g + o - f;
0552:       float d = dot(r, r);
0553:       if (d < m) m = d;
0554:     }
0555:   }
0556:   return sqrt(m);
0557: }
0558: 
0559: float getWaveform(float t) {
0560:   return texture(uWaveformTex, vec2(t, 0.5)).r;
0561: }
0562: 
0563: float getSpectrum(float t) {
0564:   return texture(uSpectrumTex, vec2(t, 0.5)).r;
0565: }
0566: 
0567: float getModulator(int index) {
0568:   return texture(uModulatorTex, vec2((float(index) + 0.5) / 8.0, 0.5)).r;
0569: }
0570: 
0571: vec2 getMidiNote(int index) {
0572:   return texture(uMidiTex, vec2((float(index) + 0.5) / 128.0, 0.5)).rg;
0573: }
0574: 
0575: float oscilloSample(float t) {
0576:   float idx = clamp(t, 0.0, 1.0) * 255.0;
0577:   int i0 = int(floor(idx));
0578:   int i1 = min(255, i0 + 1);
0579:   float f = fract(idx);
0580:   float a = uOscillo[i0];
0581:   float b = uOscillo[i1];
0582:   return mix(a, b, f);
0583: }
0584: 
0585: float glyphShape(vec2 p, float seed, float family, float complexity) {
0586:   float thickness = mix(0.035, 0.012, complexity);
0587:   float g = 10.0;
0588:   float h1 = hash21(vec2(seed, family));
0589:   float h2 = hash21(vec2(seed + 11.3, family * 1.7));
0590:   float h3 = hash21(vec2(seed + 23.7, family * 2.3));
0591:   vec2 a = vec2(-0.32 + h1 * 0.2, -0.25 + h2 * 0.15);
0592:   vec2 b = vec2(0.32 - h2 * 0.2, 0.25 - h3 * 0.15);
0593:   vec2 c = vec2(-0.22 + h3 * 0.2, 0.28 - h1 * 0.18);
0594:   vec2 d = vec2(0.22 - h1 * 0.2, -0.28 + h2 * 0.18);
0595:   g = min(g, sdSegment(p, a, b));
0596:   g = min(g, sdSegment(p, c, d));
0597:   if (h1 > 0.4) {
0598:     g = min(g, sdSegment(p, vec2(-0.28, 0.0), vec2(0.28, 0.0)));
0599:   }
0600:   if (h2 > 0.5) {
0601:     float radius = 0.18 + h3 * 0.12;
0602:     vec2 center = vec2(0.0, -0.02 + (h1 - 0.5) * 0.2);
0603:     g = min(g, sdArc(p, center, radius, thickness));
0604:   }
0605:   return g;
0606: }
0607: 
0608: float crystalField(vec2 p, float seed, float scale) {
0609:   vec2 gv = p * scale;
0610:   vec2 cell = floor(gv);
0611:   vec2 f = fract(gv);
0612:   float d = 10.0;
0613:   for (int j = -1; j <= 1; j += 1) {
0614:     for (int i = -1; i <= 1; i += 1) {
0615:       vec2 offset = vec2(float(i), float(j));
0616:       vec2 id = cell + offset;
0617:       float rnd = hash21(id + seed);
0618:       vec2 point = offset + vec2(rnd, fract(rnd * 1.7));
0619:       d = min(d, length(f - point));
0620:     }
0621:   }
0622:   return d;
0623: }
0624: 
0625: vec3 applyBlendMode(vec3 base, vec3 blend, float mode, float opacity) {
0626:   vec3 result;
0627:   if (mode < 0.5) {
0628:     result = blend;
0629:   } else if (mode < 1.5) {
0630:     result = blendAdd(base, blend);
0631:   } else if (mode < 2.5) {
0632:     result = blendMultiply(base, blend);
0633:   } else if (mode < 3.5) {
0634:     result = blendScreen(base, blend);
0635:   } else if (mode < 4.5) {
0636:     result = blendOverlay(base, blend);
0637:   } else {
0638:     result = blendDifference(base, blend);
0639:   }
0640:   return mix(base, result, opacity);
0641: }
0642: 
0643: vec3 palette(float t);
0644: 
0645: float plasmaDefault(vec2 uv, float t) {
0646:   float v = 0.0;
0647:   vec2 p = uv * uPlasmaScale;
0648:   float audio = (uRms * 0.5 + uPeak * 0.5) * uPlasmaAudioReact;
0649:   
0650:   for (float i = 1.0; i < 9.0; i += 1.0) {
0651:       if (i > uPlasmaComplexity) break;
0652:       v += sin(p.x * i + t * uPlasmaSpeed * (1.0 + i * 0.1) + audio * i);
0653:       v += sin(p.y * i - t * uPlasmaSpeed * (1.1 + i * 0.15) + audio * 0.5);
0654:       p += vec2(sin(t * 0.1), cos(t * 0.1)) * 0.5;
0655:   }
0656:   
0657:   return v / uPlasmaComplexity * 0.5 + 0.5;
0658: }
0659: 
0660: vec3 samplePlasma(vec2 uv, float t) {
0661: #ifdef HAS_CUSTOM_PLASMA
0662:   return customPlasma(uv, t);
0663: #else
0664:   float p = plasmaDefault(uv, t);
0665:   return palette(p);
0666: #endif
0667: }
0668: 
0669: float particleField(vec2 uv, float t, float density, float speed, float size) {
0670:   float grid = mix(18.0, 90.0, density);
0671:   float audio = (uRms * 0.4 + uPeak * 0.6) * uParticleAudioLift;
0672:   vec2 drift = vec2(t * 0.02 * (0.2 + speed), t * 0.015 * (0.2 + speed));
0673:   
0674:   // Add turbulence
0675:   vec2 turb = vec2(
0676:       sin(uv.y * 4.0 + t * 0.5),
0677:       cos(uv.x * 4.0 + t * 0.5)
0678:   ) * uParticleTurbulence * 0.5;
0679:   
0680:   vec2 gv = uv * grid + drift + turb;
0681:   vec2 cell = floor(gv);
0682:   vec2 f = fract(gv);
0683:   float rnd = hash21(cell);
0684:   vec2 pos = vec2(hash21(cell + 1.3), hash21(cell + 9.1));
0685:   pos = 0.2 + 0.6 * pos;
0686:   
0687:   float twinkle = 0.4 + 0.6 * sin(t * (1.5 + rnd * 2.5) + rnd * 6.2831) + audio;
0688:   float radius = mix(0.05, 0.015, density) * mix(1.4, 0.6, size);
0689:   float d = distance(f, pos);
0690:   float spark = smoothstep(radius, 0.0, d);
0691:   return spark * twinkle;
0692: }
0693: 
0694: vec2 rotate2d(vec2 p, float angle) {
0695:   float c = cos(angle);
0696:   float s = sin(angle);
0697:   return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
0698: }
0699: 
0700: float sdRing(vec2 p, float r, float th) {
0701:   return abs(length(p) - r) - th;
0702: }
0703: 
0704: float opDisplace(float d, vec3 p, float amount, float freq) {
0705:   float displacement = sin(freq * p.x) * sin(freq * p.y) * sin(freq * p.z) * amount;
0706:   return d + displacement;
0707: }
0708: 
0709: float opOnion(float d, float thickness) {
0710:   return abs(d) - thickness;
0711: }
0712: 
0713: float opRound(float d, float r) {
0714:   return d - r;
0715: }
0716: 
0717: float opAnnular(float d, float thickness) {
0718:   return abs(d) - thickness * 0.5;
0719: }
0720: 
0721: float sdHexagon(vec2 p, float r) {
0722:   const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
0723:   p = abs(p);
0724:   p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
0725:   p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
0726:   return length(p) * sign(p.y);
0727: }
0728: 
0729: float sdStar(vec2 p, float r, int n, float m) {
0730:   float an = 3.141593 / float(n);
0731:   float en = 3.141593 / m;
0732:   vec2 acs = vec2(cos(an), sin(an));
0733:   vec2 ecs = vec2(cos(en), sin(en));
0734:   float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
0735:   p = length(p) * vec2(cos(bn), abs(sin(bn)));
0736:   p -= r * acs;
0737:   p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
0738:   return length(p) * sign(p.x);
0739: }
0740: 
0741: float sdCircle(vec2 p, float r) {
0742:   return length(p) - r;
0743: }
0744: 
0745: float sdBox(vec2 p, vec2 b) {
0746:   vec2 d = abs(p) - b;
0747:   return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
0748: }
0749: 
0750: float sdEquilateralTriangle(vec2 p, float r) {
0751:   float k = 1.7320508;
0752:   p.x = abs(p.x) - r;
0753:   p.y = p.y + r / k;
0754:   if (p.x + k * p.y > 0.0) {
0755:     p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
0756:   }
0757:   p.x -= clamp(p.x, -2.0 * r, 0.0);
0758:   return -length(p) * sign(p.y);
0759: }
0760: 
0761: vec3 applySaturation(vec3 color, float amount) {
0762:   float luma = dot(color, vec3(0.299, 0.587, 0.114));
0763:   return mix(vec3(luma), color, amount);
0764: }
0765: 
0766: vec3 applyContrast(vec3 color, float amount) {
0767:   return (color - 0.5) * amount + 0.5;
0768: }
0769: 
0770: vec3 shiftPalette(vec3 color, float shift) {
0771:   float angle = shift * 6.28318;
0772:   
0773:   // Apply Chemistry Constraints
0774:   if (uChemistryMode > 0.5 && uChemistryMode < 1.5) { // Triadic
0775:     angle = floor(shift * 3.0) * (6.28318 / 3.0);
0776:   } else if (uChemistryMode > 1.5 && uChemistryMode < 2.5) { // Complementary
0777:     angle = floor(shift * 2.0) * 3.14159;
0778:   } else if (uChemistryMode > 2.5) { // Monochromatic
0779:     float luma = dot(color, vec3(0.299, 0.587, 0.114));
0780:     return mix(vec3(luma), uPalette[0] * luma, 0.8);
0781:   }
0782: 
0783:   mat3 rot = mat3(
0784:     0.299 + 0.701 * cos(angle) + 0.168 * sin(angle), 0.587 - 0.587 * cos(angle) + 0.330 * sin(angle), 0.114 - 0.114 * cos(angle) - 0.497 * sin(angle),
0785:     0.299 - 0.299 * cos(angle) - 0.328 * sin(angle), 0.587 + 0.413 * cos(angle) + 0.035 * sin(angle), 0.114 - 0.114 * cos(angle) + 0.292 * sin(angle),
0786:     0.299 - 0.300 * cos(angle) + 1.250 * sin(angle), 0.587 - 0.588 * cos(angle) - 1.050 * sin(angle), 0.114 + 0.886 * cos(angle) - 0.203 * sin(angle)
0787:   );
0788:   return clamp(rot * color, 0.0, 1.0);
0789: }
0790: 
0791: vec2 kaleidoscope(vec2 uv, float amount) {
0792:   if (amount <= 0.01) return uv;
0793:   vec2 centered = uv * 2.0 - 1.0;
0794:   float angle = atan(centered.y, centered.x) + uKaleidoscopeRotation;
0795:   float radius = length(centered);
0796:   float slices = mix(1.0, 8.0, amount);
0797:   float slice = 6.28318 / slices;
0798:   angle = mod(angle, slice);
0799:   angle = abs(angle - slice * 0.5);
0800:   vec2 rotated = vec2(cos(angle), sin(angle)) * radius;
0801:   return rotated * 0.5 + 0.5;
0802: }
0803: 
0804: vec3 posterize(vec3 color, float amount) {
0805:   if (amount <= 0.01) return color;
0806:   float levels = mix(16.0, 3.0, amount);
0807:   return floor(color * levels) / levels;
0808: }
0809: 
0810: vec3 palette(float t) {
0811:   return mix(uPalette[0], uPalette[1], smoothstep(0.0, 0.25, t)) +
0812:          mix(uPalette[1], uPalette[2], smoothstep(0.25, 0.5, t)) +
0813:          mix(uPalette[2], uPalette[3], smoothstep(0.5, 0.75, t)) +
0814:          mix(uPalette[3], uPalette[4], smoothstep(0.75, 1.0, t));
0815: }
0816: 
0817: // --- Rock Generator Functions ---
0818: 
0819: float lightningBolt(vec2 uv, float t, float audio) {
0820:   vec2 p = (uv * 2.0 - 1.0);
0821:   p.x *= uAspect;
0822:   
0823:   float v = 0.0;
0824:   float intensity = uLightningOpacity;
0825:   float branches = uLightningBranches; 
0826:   float thickness = uLightningThickness; 
0827:   
0828:   for (float i = 0.0; i < 3.0; i += 1.0) {
0829:     if (i >= uLightningBranches) break;
0830:     float t2 = t * uLightningSpeed * (1.0 + i * 0.5) + i * 135.2;
0831:     vec2 seed = vec2(t2 * 0.5, t2 * 0.2);
0832:     
0833:     float noiseVal = fbm(p * (2.0 + i) + seed);
0834:     float bolt = 1.0 / (abs(p.y + (noiseVal - 0.5) * 1.5) + 0.05);
0835:     
0836:     // Masking to keep it somewhat central but wild
0837:     bolt *= smoothstep(1.5, 0.0, abs(p.x));
0838:     
0839:     v += bolt * thickness;
0840:   }
0841:   
0842:   v *= (1.0 + audio * 2.0);
0843:   return clamp(v, 0.0, 1.0) * intensity;
0844: }
0845: 
0846: float analogOscillo(vec2 uv, float t, float audio) {
0847:   vec2 p = uv;
0848:   float v = 0.0;
0849:   
0850:   float wave = getWaveform(p.x);
0851:   float jitter = (hash21(vec2(t * 100.0, p.y)) - 0.5) * 0.01;
0852:   float dist = abs(p.y - 0.5 - wave * 0.5 + jitter);
0853:   float thickness = uAnalogOscilloThickness; 
0854:   float glow = uAnalogOscilloGlow;
0855:   
0856:   v = smoothstep(thickness, 0.0, dist);
0857:   v += exp(-dist * 20.0) * glow;
0858:   
0859:   return clamp(v, 0.0, 1.0) * uAnalogOscilloOpacity * (1.0 + audio * 0.5);
0860: }
0861: 
0862: vec2 speakerCone(vec2 uv, float bass) {
0863:   vec2 centered = uv - 0.5;
0864:   float dist = length(centered);
0865:   float push = bass * uSpeakerConeForce * 0.2 * smoothstep(0.5, 0.0, dist);
0866:   return uv - centered * push;
0867: }
0868: 
0869: vec3 glitchScanline(vec2 uv, float t, float audio) {
0870:   float speed = uGlitchScanlineSpeed;
0871:   float scan = sin(uv.y * 100.0 * uGlitchScanlineCount + t * speed) * 0.5 + 0.5;
0872:   vec3 col = vec3(scan);
0873:   
0874:   if (hash21(vec2(t * speed, floor(uv.y * 20.0))) > 0.95) {
0875:     col.r = 1.0;
0876:     col.gb *= 0.0;
0877:   }
0878:   
0879:   return col * uGlitchScanlineOpacity * (1.0 + audio);
0880: }
0881: 
0882: vec3 laserStarfield(vec2 uv, float t, float audio) {
0883:   vec2 p = uv * 2.0 - 1.0;
0884:   p.x *= uAspect;
0885:   vec3 col = vec3(0.0);
0886:   float layers = 3.0;
0887:   for (float i = 0.0; i < layers; i += 1.0) {
0888:     float depth = fract(t * uLaserStarfieldSpeed * 0.1 + i/layers);
0889:     float scale = mix(20.0, 0.1, depth);
0890:     float fade = depth * smoothstep(1.0, 0.8, depth);
0891:     vec2 gv = p * scale + i * 453.2;
0892:     vec2 id = floor(gv);
0893:     vec2 f = fract(gv) - 0.5;
0894:     float rnd = hash21(id);
0895:     if(rnd > 1.0 - uLaserStarfieldDensity * 0.2) {
0896:       float star = smoothstep(0.1, 0.0, length(f));
0897:       col += palette(rnd) * star * fade;
0898:     }
0899:   }
0900:   return col * uLaserStarfieldOpacity * (1.0 + audio * 0.5);
0901: }
0902: 
0903: vec3 pulsingRibbons(vec2 uv, float t, float audio) {
0904:   vec3 col = vec3(0.0);
0905:   for (float i = 0.0; i < uPulsingRibbonsCount; i += 1.0) {
0906:     float offset = i * 0.2;
0907:     float wave = sin(uv.x * 5.0 + t * 2.0 + offset) * 0.2;
0908:     wave += sin(uv.x * 10.0 - t * 1.5) * 0.1;
0909:     float d = abs(uv.y - 0.5 - wave);
0910:     float ribbon = smoothstep(uPulsingRibbonsWidth, 0.0, d);
0911:     col += palette(fract(i * 0.3 + t * 0.1)) * ribbon;
0912:   }
0913:   return col * uPulsingRibbonsOpacity * (1.0 + audio);
0914: }
0915: 
0916: vec3 electricArc(vec2 uv, float t, float audio) {
0917:   vec2 p = uv * 2.0 - 1.0;
0918:   float d = length(p);
0919:   float arc = abs(d - uElectricArcRadius);
0920:   float noise = fbm(p * uElectricArcChaos + t * 2.0);
0921:   float val = smoothstep(0.05, 0.0, arc + noise * 0.1);
0922:   return vec3(0.6, 0.8, 1.0) * val * uElectricArcOpacity * (1.0 + audio);
0923: }
0924: 
0925: vec3 pyroBurst(vec2 uv, float t, float peak) {
0926:   vec2 p = uv - 0.5;
0927:   p.x *= uAspect;
0928:   float d = length(p);
0929:   float angle = atan(p.y, p.x);
0930:   float burst = smoothstep(0.1, 0.0, abs(sin(angle * 10.0 + t * 10.0))) * smoothstep(uPyroBurstForce * peak, 0.0, d);
0931:   return vec3(1.0, 0.5, 0.2) * burst * uPyroBurstOpacity;
0932: }
0933: 
0934: vec3 geoWireframe(vec2 uv, float t, float audio) {
0935:   vec2 p = uv * 2.0 - 1.0;
0936:   p = rotate2d(p, t * 0.5);
0937:   float shape = 0.0;
0938:   if(uGeoWireframeShape < 0.5) shape = abs(sdBox(p, vec2(uGeoWireframeScale))) - 0.01;
0939:   else shape = abs(sdEquilateralTriangle(p, uGeoWireframeScale)) - 0.01;
0940:   float val = smoothstep(0.02, 0.0, shape);
0941:   return palette(0.8) * val * uGeoWireframeOpacity * (1.0 + audio * 0.5);
0942: }
0943: 
0944: vec3 signalNoise(vec2 uv, float t) {
0945:   float n = hash21(uv + t);
0946:   float line = step(0.99, hash21(vec2(t, uv.y)));
0947:   return vec3(n * 0.2 + line) * uSignalNoiseOpacity * uSignalNoiseAmount;
0948: }
0949: 
0950: vec3 infiniteWormhole(vec2 uv, float t, float audio) {
0951:   vec2 p = uv * 2.0 - 1.0;
0952:   p.x *= uAspect;
0953:   float r = length(p);
0954:   float a = atan(p.y, p.x);
0955:   
0956:   // The Weave: animate center
0957:   vec2 center = vec2(sin(t * uWormholeSpeed * 0.5) * uWormholeWeave, cos(t * uWormholeSpeed * 0.3) * uWormholeWeave);
0958:   p -= center;
0959:   r = length(p);
0960:   
0961:   float z = 1.0 / (r + 0.01);
0962:   float uv_z = z + t * uWormholeSpeed;
0963:   
0964:   float col = 0.0;
0965:   for (float i = 0.0; i < uWormholeIter; i += 1.0) {
0966:     float shift = i * 0.5;
0967:     col += smoothstep(0.1, 0.0, abs(sin(a * 3.0 + uv_z + shift) * 0.5));
0968:   }
0969:   
0970:   vec3 baseCol = palette(fract(uv_z * 0.1));
0971:   return baseCol * col * uWormholeOpacity * (1.0 + audio);
0972: }
0973: 
0974: vec3 ribbonTunnel(vec2 uv, float t, float audio) {
0975:   vec2 p = uv * 2.0 - 1.0;
0976:   float r = length(p);
0977:   float a = atan(p.y, p.x);
0978:   
0979:   float z = 1.0 / (r + 0.01);
0980:   float twist = a + z * uRibbonTunnelTwist + t * uRibbonTunnelSpeed;
0981:   
0982:   float ribbon = smoothstep(0.2, 0.0, abs(sin(twist * 4.0)));
0983:   ribbon *= smoothstep(0.0, 0.5, r); // Fade center
0984:   
0985:   return palette(fract(z * 0.2)) * ribbon * uRibbonTunnelOpacity * (1.0 + audio);
0986: }
0987: 
0988: vec3 fractalTunnel(vec2 uv, float t, float audio) {
0989:   vec2 p = (uv - 0.5) * 2.0;
0990:   p.x *= uAspect;
0991:   
0992:   float col = 0.0;
0993:   float z = t * uFractalTunnelSpeed;
0994:   
0995:   for(int i=0; i<4; i++) {
0996:     p = abs(p) / dot(p,p) - 0.5;
0997:     p = rotate2d(p, z * 0.1);
0998:     col += exp(-length(p) * (5.0 - uFractalTunnelComplexity));
0999:   }
1000:   
1001:   return palette(col * 0.1) * col * uFractalTunnelOpacity * (1.0 + audio);
1002: }
1003: 
1004: vec3 circuitConduit(vec2 uv, float t, float audio) {
1005:   vec2 p = uv * 2.0 - 1.0;
1006:   float r = max(abs(p.x), abs(p.y)); // Square tunnel
1007:   float z = 1.0 / (r + 0.01);
1008:   vec2 tu = vec2(atan(p.y, p.x) / 1.57, z + t * uCircuitConduitSpeed);
1009:   
1010:   float grid = step(0.95, fract(tu.x * 4.0)) + step(0.95, fract(tu.y * 10.0));
1011:   float pulses = step(0.98, fract(tu.y * 2.0 - t * 5.0));
1012:   
1013:   return vec3(0.2, 0.5, 1.0) * (grid + pulses * 2.0) * uCircuitConduitOpacity * (1.0 + audio);
1014: }
1015: 
1016: vec3 auraPortal(vec2 uv, float t, float audio) {
1017:   vec2 p = uv * 2.0 - 1.0;
1018:   float d = length(p);
1019:   float aura = exp(-d * 3.0) * (1.0 + audio);
1020:   vec3 col = uAuraPortalColor < 0.5 ? vec3(0.1, 0.4, 1.0) : vec3(1.0, 0.2, 0.5);
1021:   return col * aura * uAuraPortalOpacity;
1022: }
1023: 
1024: vec3 frequencyTerrain(vec2 uv, float t, float audio) {
1025:   float band = floor(uv.x * 64.0);
1026:   float amp = uSpectrum[int(band)];
1027:   float d = abs(uv.y - 0.5 - (amp - 0.5) * uFreqTerrainScale);
1028:   float line = smoothstep(0.02, 0.0, d);
1029:   return palette(amp) * line * uFreqTerrainOpacity;
1030: }
1031: 
1032: vec3 dataStream(vec2 uv, float t, float audio) {
1033:   vec2 gv = fract(uv * vec2(20.0, 1.0) + vec2(0.0, t * uDataStreamSpeed));
1034:   float line = step(0.98, gv.x);
1035:   float bits = step(0.9, hash21(floor(uv * vec2(20.0, 10.0) + vec2(0.0, t * 5.0))));
1036:   return vec3(0.0, 1.0, 0.4) * (line + bits) * uDataStreamOpacity * (1.0 + audio);
1037: }
1038: 
1039: vec3 causticLiquid(vec2 uv, float t, float audio) {
1040:   vec2 p = uv * 5.0;
1041:   for(int i=0; i<3; i++) {
1042:     p += sin(p.yx * 1.5 + t * uCausticLiquidSpeed) * 0.5;
1043:   }
1044:   float c = sin(p.x + p.y) * 0.5 + 0.5;
1045:   return palette(c) * c * uCausticLiquidOpacity * (1.0 + audio);
1046: }
1047: 
1048: vec3 shimmerVeil(vec2 uv, float t, float audio) {
1049:   float v = sin(uv.x * 10.0 + t) * sin(uv.y * uShimmerVeilComplexity + t * 0.5);
1050:   return vec3(0.8, 0.9, 1.0) * smoothstep(0.1, 0.0, abs(v)) * uShimmerVeilOpacity * (1.0 + audio);
1051: }
1052: 
1053: // --- New 31 Generators Helper Functions ---
1054: vec3 nebulaCloud(vec2 uv, float t, float audio) {
1055:   vec2 p = uv * uNebulaCloudDensity;
1056:   float n = fbm(p + t * uNebulaCloudSpeed);
1057:   float n2 = fbm(p * 2.0 - t * uNebulaCloudSpeed * 0.5);
1058:   vec3 col = palette(n + n2 + audio * 0.2);
1059:   return col * pow(n, 3.0) * uNebulaCloudOpacity;
1060: }
1061: 
1062: vec3 circuitBoard(vec2 uv, float t, float audio) {
1063:   vec2 p = uv * uCircuitBoardComplexity;
1064:   vec2 id = floor(p);
1065:   vec2 f = fract(p);
1066:   float h = hash21(id);
1067:   float growth = fract(t * uCircuitBoardGrowth + h);
1068:   float line = smoothstep(0.1, 0.0, abs(f.x - 0.5)) * step(f.y, growth);
1069:   float node = smoothstep(0.2, 0.0, length(f - 0.5)) * step(0.9, h);
1070:   return vec3(0.2, 0.6, 1.0) * (line + node * (1.0 + audio)) * uCircuitBoardOpacity;
1071: }
1072: 
1073: vec3 lorenzAttractor(vec2 uv, float t, float audio) {
1074:   vec2 p = (uv - 0.5) * 2.0;
1075:   float d = 10000000000.0;
1076:   vec3 curr = vec3(0.1, 0.0, 0.0);
1077:   float dt = 0.01 * uLorenzAttractorSpeed;
1078:   for(int i=0; i<20; i++) {
1079:     vec3 next;
1080:     next.x = curr.x + dt * 10.0 * (curr.y - curr.x);
1081:     next.y = curr.y + dt * (curr.x * (28.0 - curr.z) - curr.y);
1082:     next.z = curr.z + dt * (curr.x * curr.y - (8.0/3.0) * curr.z);
1083:     curr = next;
1084:     d = min(d, length(p - curr.xy * 0.05 * uLorenzAttractorChaos));
1085:   }
1086:   return palette(t * 0.1) * smoothstep(0.05, 0.0, d) * uLorenzAttractorOpacity;
1087: }
1088: 
1089: vec3 mandalaSpinner(vec2 uv, float t, float audio) {
1090:   vec2 p = (uv - 0.5) * 2.0;
1091:   p.x *= uAspect;
1092:   float r = length(p);
1093:   float a = atan(p.y, p.x) + t * uMandalaSpinnerSpeed;
1094:   float sides = uMandalaSpinnerSides;
1095:   a = mod(a, 6.28/sides) - 3.14/sides;
1096:   p = vec2(cos(a), sin(a)) * r;
1097:   float mask = smoothstep(0.02, 0.0, abs(p.y - sin(p.x * 10.0 + t) * 0.1));
1098:   return palette(r + audio) * mask * uMandalaSpinnerOpacity;
1099: }
1100: 
1101: vec3 starburstGalaxy(vec2 uv, float t, float audio) {
1102:   vec2 p = (uv - 0.5) * 2.0;
1103:   p.x *= uAspect;
1104:   vec3 col = vec3(0.0);
1105:   for (float i = 0.0; i < 10.0; i += 1.0) { // Sample limited stars for performance
1106:     float h = hash21(vec2(i, 123.4));
1107:     float burst = fract(t * uStarburstGalaxyForce + h);
1108:     vec2 dir = vec2(cos(h * 6.28), sin(h * 6.28));
1109:     vec2 pos = dir * burst * 1.5;
1110:     float star = smoothstep(0.05, 0.0, length(p - pos));
1111:     col += palette(h) * star * (1.0 - burst);
1112:   }
1113:   return col * uStarburstGalaxyOpacity * (1.0 + audio);
1114: }
1115: 
1116: vec3 digitalRainV2(vec2 uv, float t, float audio) {
1117:   vec2 p = uv * vec2(30.0, 1.0);
1118:   float col_id = floor(p.x);
1119:   float h = hash21(vec2(col_id, 456.7));
1120:   float speed = uDigitalRainV2Speed * (0.5 + h);
1121:   float drop = fract(uv.y + t * speed + h);
1122:   float mask = step(0.9, fract(p.x)) * smoothstep(0.2, 0.0, abs(drop - 0.5));
1123:   return vec3(0.0, 1.0, 0.2) * mask * uDigitalRainV2Opacity * (1.0 + audio);
1124: }
1125: 
1126: vec3 lavaFlow(vec2 uv, float t, float audio) {
1127:   vec2 p = uv * 3.0;
1128:   float n = fbm(p + vec2(t * 0.2 * uLavaFlowViscosity));
1129:   float heat = smoothstep(0.4, 0.6, n * uLavaFlowHeat);
1130:   return vec3(1.0, 0.3, 0.0) * heat * uLavaFlowOpacity * (1.0 + audio * 0.5);
1131: }
1132: 
1133: vec3 crystalGrowth(vec2 uv, float t, float audio) {
1134:   vec2 p = (uv - 0.5) * 2.0;
1135:   float d = 10000000000.0;
1136:   for(int i=0; i<5; i++) {
1137:     p = abs(p) - 0.5;
1138:     p = rotate2d(p, t * uCrystalGrowthRate * 0.1);
1139:     d = min(d, abs(p.x));
1140:   }
1141:   float edge = smoothstep(0.01 * uCrystalGrowthSharpness, 0.0, d);
1142:   return palette(audio) * edge * uCrystalGrowthOpacity;
1143: }
1144: 
1145: vec3 technoGrid3D(vec2 uv, float t, float audio) {
1146:   vec2 p = uv * 2.0 - 1.0;
1147:   float z = 1.0 / (abs(p.y) + 0.01);
1148:   vec2 grid_uv = vec2(p.x * z, z + t * uTechnoGridSpeed);
1149:   float grid = step(0.95, fract(grid_uv.x * 5.0)) + step(0.95, fract(grid_uv.y * 5.0));
1150:   float towers = step(0.98, hash21(floor(grid_uv * 5.0))) * z * uTechnoGridHeight * 0.1;
1151:   return vec3(0.0, 0.5, 1.0) * (grid + towers) * uTechnoGridOpacity * (1.0 + audio);
1152: }
1153: 
1154: vec3 magneticField(vec2 uv, float t, float audio) {
1155:   vec2 p = (uv - 0.5) * 2.0;
1156:   vec3 col = vec3(0.0);
1157:   float lines = uMagneticFieldDensity;
1158:   for (float i = 0.0; i < 20.0; i += 1.0) {
1159:     if (i >= float(lines)) break;
1160:     float h = i / lines;
1161:     vec2 force = vec2(sin(t + h * 6.28), cos(t * 0.5 + h * 6.28)) * uMagneticFieldStrength;
1162:     float d = abs(length(p - force) - 0.5);
1163:     col += palette(h) * smoothstep(0.02, 0.0, d);
1164:   }
1165:   return col * uMagneticFieldOpacity * (1.0 + audio);
1166: }
1167: 
1168: vec3 prismShards(vec2 uv, float t, float audio) {
1169:   vec2 p = uv;
1170:   vec3 col = vec3(0.0);
1171:   for (float i = 0.0; i < 5.0; i += 1.0) {
1172:     if (i >= float(uPrismShardsCount)) break;
1173:     vec2 pos = vec2(hash21(vec2(i, 1.1)), hash21(vec2(i, 2.2)));
1174:     float dist = length(p - pos);
1175:     float refract_val = uPrismShardsRefraction * sin(t + i);
1176:     col += palette(dist + refract_val) * smoothstep(0.1, 0.0, dist);
1177:   }
1178:   return col * uPrismShardsOpacity * (1.0 + audio);
1179: }
1180: 
1181: vec3 neuralNet(vec2 uv, float t, float audio) {
1182:   vec2 p = uv * 10.0 * uNeuralNetDensity;
1183:   vec2 id = floor(p);
1184:   vec2 f = fract(p);
1185:   float col = 0.0;
1186:   for(int y=-1; y<=1; y++) {
1187:     for(int x=-1; x<=1; x++) {
1188:       vec2 neighbor = vec2(float(x), float(y));
1189:       float h = hash21(id + neighbor);
1190:       vec2 pt = neighbor + sin(t * uNeuralNetActivity + h * 6.28) * 0.5;
1191:       float d = length(f - pt);
1192:       col += smoothstep(0.1, 0.0, d);
1193:     }
1194:   }
1195:   return vec3(0.5, 0.8, 1.0) * col * uNeuralNetOpacity * (1.0 + audio);
1196: }
1197: 
1198: vec3 auroraChord(vec2 uv, float t, float audio) {
1199:   float v = 0.0;
1200:   for (float i = 0.0; i < 3.0; i += 1.0) {
1201:     float shift = i * uAuroraChordColorRange;
1202:     v += sin(uv.x * 5.0 + t + shift) * sin(uv.y * 2.0 - t * 0.5);
1203:   }
1204:   return palette(v * 0.2 + t * 0.1) * abs(v) * uAuroraChordOpacity * uAuroraChordWaviness;
1205: }
1206: 
1207: vec3 vhsGlitch(vec2 uv, float t, float audio) {
1208:   vec2 p = uv;
1209:   p.x += (hash21(vec2(t, floor(uv.y * 10.0))) - 0.5) * uVhsGlitchJitter * 0.1;
1210:   float noise = hash21(uv + t) * uVhsGlitchNoise;
1211:   vec3 col = vec3(noise);
1212:   if (abs(uv.y - fract(t)) < 0.01) col.r = 1.0;
1213:   return col * uVhsGlitchOpacity * (1.0 + audio);
1214: }
1215: 
1216: vec3 moirePattern(vec2 uv, float t, float audio) {
1217:   vec2 p = (uv - 0.5) * uMoirePatternScale;
1218:   float v1 = sin(p.x * 10.0 + t * uMoirePatternSpeed);
1219:   vec2 p2 = rotate2d(p, t * 0.2);
1220:   float v2 = sin(p2.x * 10.0);
1221:   float moire = v1 * v2;
1222:   return vec3(moire) * uMoirePatternOpacity * (1.0 + audio);
1223: }
1224: 
1225: vec3 hypercube(vec2 uv, float t, float audio) {
1226:   vec2 p = (uv - 0.5) * 2.0;
1227:   float rot = t * uHypercubeSpeed;
1228:   p = rotate2d(p, rot);
1229:   float box = max(abs(p.x), abs(p.y));
1230:   float inner = max(abs(p.x), abs(p.y)) * uHypercubeProjection;
1231:   float mask = smoothstep(0.5, 0.48, box) - smoothstep(0.4, 0.38, box);
1232:   mask += (smoothstep(0.3, 0.28, inner) - smoothstep(0.2, 0.18, inner));
1233:   return palette(rot) * mask * uHypercubeOpacity * (1.0 + audio);
1234: }
1235: 
1236: vec3 fluidSwirl(vec2 uv, float t, float audio) {
1237:   vec2 p = uv;
1238:   for(int i=0; i<3; i++) {
1239:     p += sin(p.yx * 4.0 + t) * 0.1 * uFluidSwirlVorticity;
1240:   }
1241:   float swirl = length(p - uv);
1242:   return palette(swirl * uFluidSwirlColorMix) * swirl * 10.0 * uFluidSwirlOpacity;
1243: }
1244: 
1245: vec3 asciiStream(vec2 uv, float t, float audio) {
1246:   vec2 p = floor(uv * uAsciiStreamResolution) / uAsciiStreamResolution;
1247:   float h = hash21(p + floor(t * 10.0));
1248:   float bright = (sin(uv.x * 10.0) + sin(uv.y * 10.0)) * 0.5 + 0.5;
1249:   float mask = step(0.5, fract(h * 10.0));
1250:   return vec3(0.0, 1.0, 0.0) * mask * bright * uAsciiStreamContrast * uAsciiStreamOpacity;
1251: }
1252: 
1253: vec3 retroWave(vec2 uv, float t, float audio) {
1254:   vec2 p = uv * 2.0 - 1.0;
1255:   float grid = technoGrid3D(uv, t, uRetroWaveGridSpeed).b;
1256:   float sun = smoothstep(uRetroWaveSunSize * 0.4, uRetroWaveSunSize * 0.38, length(p - vec2(0.0, 0.3)));
1257:   if (p.y < 0.3 && fract(p.y * 20.0) < 0.2) sun = 0.0;
1258:   return (vec3(1.0, 0.0, 0.5) * sun + vec3(0.0, 0.8, 1.0) * grid) * uRetroWaveOpacity;
1259: }
1260: 
1261: vec3 bubblePop(vec2 uv, float t, float audio) {
1262:   vec2 p = uv * 5.0;
1263:   vec2 id = floor(p);
1264:   vec2 f = fract(p);
1265:   float h = hash21(id);
1266:   float size = fract(t * uBubblePopPopRate + h) * uBubblePopSize;
1267:   float bubble = smoothstep(size, size - 0.02, length(f - 0.5));
1268:   return palette(h) * bubble * uBubblePopOpacity * (1.0 + audio);
1269: }
1270: 
1271: vec3 soundWave3D(vec2 uv, float t, float audio) {
1272:   float z = 1.0 / (uv.y + 0.01);
1273:   float wave = getWaveform(uv.x * uSoundWave3DSmoothness) * uSoundWave3DAmplitude;
1274:   float d = abs(uv.y - 0.5 - wave * 0.2);
1275:   return palette(wave) * smoothstep(0.02, 0.0, d) * uSoundWave3DOpacity;
1276: }
1277: 
1278: vec3 particleVortex(vec2 uv, float t, float audio) {
1279:   vec2 p = (uv - 0.5) * 2.0;
1280:   float r = length(p);
1281:   float a = atan(p.y, p.x) + t * uParticleVortexSpin + r * uParticleVortexSuction;
1282:   vec2 pv = vec2(cos(a), sin(a)) * r;
1283:   float dots = step(0.99, hash21(floor(pv * 20.0)));
1284:   return palette(r) * dots * uParticleVortexOpacity * (1.0 + audio);
1285: }
1286: 
1287: vec3 glowWorms(vec2 uv, float t, float audio) {
1288:   vec2 p = uv;
1289:   float worm = 0.0;
1290:   for(float i=0; i<5.0; i++) {
1291:     vec2 pos = vec2(sin(t * uGlowWormsSpeed + i), cos(t * 0.7 * uGlowWormsSpeed + i)) * 0.4 + 0.5;
1292:     float d = length(p - pos);
1293:     worm += exp(-d * (10.0 / uGlowWormsLength));
1294:   }
1295:   return palette(audio) * worm * uGlowWormsOpacity;
1296: }
1297: 
1298: vec3 mirrorMaze(vec2 uv, float t, float audio) {
1299:   vec2 p = (uv - 0.5) * 2.0;
1300:   for(float i=0; i<8.0; i++) {
1301:     if (i >= float(uMirrorMazeRecursion)) break;
1302:     p = abs(p) - 0.2;
1303:     p = rotate2d(p, uMirrorMazeAngle);
1304:   }
1305:   float d = length(p);
1306:   return palette(d + t) * smoothstep(0.1, 0.0, d) * uMirrorMazeOpacity;
1307: }
1308: 
1309: vec3 pulseHeart(vec2 uv, float t, float audio) {
1310:   vec2 p = (uv - 0.5) * 2.0;
1311:   float r = length(p);
1312:   float pulse = sin(t * 5.0 * uPulseHeartBeats) * 0.1 + 0.5;
1313:   float heart = 0.0;
1314:   for(float i=0; i<10.0; i++) {
1315:     if (i >= float(uPulseHeartLayers)) break;
1316:     float radius = pulse * (i / uPulseHeartLayers);
1317:     heart += smoothstep(radius, radius - 0.02, r) - smoothstep(radius - 0.04, radius - 0.06, r);
1318:   }
1319:   return vec3(1.0, 0.1, 0.2) * heart * uPulseHeartOpacity * (1.0 + audio);
1320: }
1321: 
1322: vec3 dataShards(vec2 uv, float t, float audio) {
1323:   vec2 p = (uv - 0.5) * 2.0;
1324:   vec3 col = vec3(0.0);
1325:   for(float i=0; i<5.0; i++) {
1326:     float h = hash21(vec2(i, 88.8));
1327:     vec2 dir = vec2(cos(t * uDataShardsSpeed + h * 6.28), sin(t * uDataShardsSpeed + h * 6.28));
1328:     float shard = smoothstep(0.1 * uDataShardsSharpness, 0.0, abs(dot(p, dir) - h));
1329:     col += palette(h) * shard;
1330:   }
1331:   return col * uDataShardsOpacity * (1.0 + audio);
1332: }
1333: 
1334: vec3 hexCell(vec2 uv, float t, float audio) {
1335:   vec2 p = uv * 10.0 * uHexCellScale;
1336:   vec2 r = vec2(1.0, 1.73);
1337:   vec2 h = r * 0.5;
1338:   vec2 a = mod(p, r) - h;
1339:   vec2 b = mod(p - h, r) - h;
1340:   vec2 gv = dot(a, a) < dot(b, b) ? a : b;
1341:   float d = length(gv);
1342:   float pulse = sin(t * uHexCellPulse) * 0.1 + 0.4;
1343:   float hex = smoothstep(pulse, pulse - 0.05, d);
1344:   return palette(d) * hex * uHexCellOpacity * (1.0 + audio);
1345: }
1346: 
1347: vec3 plasmaBall(vec2 uv, float t, float audio) {
1348:   vec2 p = (uv - 0.5) * 2.0;
1349:   float col = 0.0;
1350:   for(float i=0; i<20.0; i++) {
1351:     if (i >= float(uPlasmaBallFilaments)) break;
1352:     float h = i * 123.4;
1353:     vec2 target = vec2(sin(t + h), cos(t * 0.5 + h)) * 0.8;
1354:     float line = smoothstep(0.02, 0.0, abs(length(p - target * sin(t)) - 0.1));
1355:     col += line;
1356:   }
1357:   return vec3(0.6, 0.2, 1.0) * col * uPlasmaBallVoltage * uPlasmaBallOpacity;
1358: }
1359: 
1360: vec3 warpDrive(vec2 uv, float t, float audio) {
1361:   vec2 p = (uv - 0.5) * 2.0;
1362:   float a = atan(p.y, p.x);
1363:   float r = length(p);
1364:   float streaks = step(0.95, hash21(vec2(floor(a * 20.0), 1.0)));
1365:   float star = streaks * smoothstep(1.0, 0.0, fract(r - t * uWarpDriveWarp));
1366:   return vec3(0.8, 0.9, 1.0) * star * uWarpDriveGlow * uWarpDriveOpacity * (1.0 + audio);
1367: }
1368: 
1369: vec3 visualFeedback(vec2 uv, float t, float audio) {
1370:   // This is a pseudo-feedback since we can't easily sample the backbuffer here
1371:   // We simulate it with recursive coordinate warping
1372:   vec2 p = uv;
1373:   float f = 0.0;
1374:   for(int i=0; i<4; i++) {
1375:     p = (p - 0.5) * uVisualFeedbackZoom + 0.5;
1376:     p = rotate2d(p - 0.5, uVisualFeedbackRotation) + 0.5;
1377:     f += fbm(p * 5.0 + t);
1378:   }
1379:   return palette(f * 0.2) * f * 0.5 * uVisualFeedbackOpacity;
1380: }
1381: 
1382: vec3 myceliumGrowth(vec2 uv, float t, float audio) {
1383:   vec2 p = uv * 5.0;
1384:   float n = fbm(p + t * 0.1 * uMyceliumGrowthSpread);
1385:   float pattern = smoothstep(0.4, 0.5, n);
1386:   pattern -= smoothstep(0.5, 0.6, n);
1387:   float decay = exp(-t * uMyceliumGrowthDecay * 0.1);
1388:   return palette(n + audio) * pattern * decay * uMyceliumGrowthOpacity;
1389: }
1390: 
1391: // --- EDM Generator Functions ---
1392: vec3 hueRotate(vec3 col, float hue) {
1393:   float s = sin(hue);
1394:   float c = cos(hue);
1395:   mat3 rot = mat3(
1396:     0.299 + 0.701*c + 0.168*s, 0.587 - 0.587*c + 0.330*s, 0.114 - 0.114*c - 0.497*s,
1397:     0.299 - 0.299*c - 0.328*s, 0.587 + 0.413*c + 0.035*s, 0.114 - 0.114*c + 0.292*s,
1398:     0.299 - 0.300*c + 1.250*s, 0.587 - 0.588*c - 1.050*s, 0.114 + 0.886*c - 0.203*s
1399:   );
1400:   return clamp(rot * col, 0.0, 1.0);
1401: }
1402: 
1403: vec3 laserBeam(vec2 uv, float t, float audio) {
1404:   vec2 centered = uv - 0.5;
1405:   centered.x *= uAspect;
1406:   vec3 color = vec3(0.0);
1407:   float beamCount = (uLaserMode > 3.5) ? 1.0 : uLaserBeamCount;
1408: 
1409:   for (float i = 0.0; i < 16.0; i += 1.0) {
1410:     if (i >= beamCount) break;
1411: 
1412:     float angle;
1413:     vec2 beamOrigin = vec2(0.0);
1414:     float beamLength = uLaserBeamLength;
1415: 
1416:     // Mode 0: Radial - beams emanate from center
1417:     if (uLaserMode < 0.5) {
1418:       angle = uLaserRotation + t * uLaserRotationSpeed + i * uLaserSpread / beamCount;
1419:     }
1420:     // Mode 1: Parallel - beams move horizontally
1421:     else if (uLaserMode < 1.5) {
1422:       angle = uLaserRotation;
1423:       float yOffset = (i / beamCount - 0.5) * 0.8;
1424:       beamOrigin = vec2(-0.5, yOffset);
1425:     }
1426:     // Mode 2: Crossing - beams cross in X pattern
1427:     else if (uLaserMode < 2.5) {
1428:       float side = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
1429:       angle = uLaserRotation + t * uLaserRotationSpeed * side + (i * 0.2 - 0.5) * side;
1430:       beamOrigin = vec2(-0.5 * side, -0.5);
1431:     }
1432:     // Mode 3: Scanning - single beam sweeps back and forth
1433:     else {
1434:       float sweep = sin(t * uLaserRotationSpeed + i * 0.5) * uLaserSpread * 0.5;
1435:       angle = uLaserRotation + sweep;
1436:     }
1437:     // Mode 4: Distance Sweep - single beam across screen from far origin
1438:     if (uLaserMode > 3.5) {
1439:       float sweep = sin(t * uLaserRotationSpeed) * 0.6;
1440:       angle = uLaserRotation;
1441:       beamOrigin = vec2(-1.2, sweep);
1442:       beamLength = 3.0;
1443:     }
1444: 
1445:     vec2 dir = vec2(cos(angle), sin(angle));
1446:     vec2 delta = centered - beamOrigin;
1447: 
1448:     // Distance to beam line
1449:     float proj = dot(delta, dir);
1450:     float perp = abs(dot(delta, vec2(-dir.y, dir.x)));
1451: 
1452:     // Beam visibility
1453:     float inBeam = step(0.0, proj) * step(proj, beamLength);
1454: 
1455:     // Soft edge with audio-reactive width
1456:     float width = uLaserBeamWidth * (1.0 + audio * uLaserAudioReact * 0.5);
1457:     float beam = smoothstep(width, 0.0, perp) * inBeam;
1458:     float glow = exp(-perp / (width * 4.0)) * uLaserGlow * inBeam * 0.5;
1459: 
1460:     // Color with optional shift
1461:     vec3 beamColor = palette(0.3 + i * 0.1);
1462:     if (uLaserColorShift > 0.0) {
1463:       float hueShift = (i / beamCount + audio * uLaserAudioReact) * uLaserColorShift;
1464:       beamColor = hueRotate(beamColor, hueShift * 6.28);
1465:     }
1466: 
1467:     color += beamColor * (beam + glow);
1468:   }
1469:   return color * uLaserOpacity;
1470: }
1471: 
1472: vec3 strobeFlash(vec2 uv, float t, float audio, float peak) {
1473:   float beatPhase = fract(t * uStrobeRate * 0.5);
1474:   float flash = step(beatPhase, uStrobeDutyCycle);
1475: 
1476:   // Audio trigger override
1477:   if (uStrobeAudioTrigger > 0.5 && peak > uStrobeThreshold) {
1478:     flash = 1.0;
1479:   }
1480: 
1481:   // Fade decay
1482:   float fadeT = beatPhase / max(uStrobeDutyCycle, 0.01);
1483:   flash *= exp(-fadeT * (1.0 / max(uStrobeFadeOut, 0.01)));
1484: 
1485:   vec3 color = vec3(0.85, 0.9, 1.0); // Soft cool white (prevents retina burn)
1486: 
1487:   // Mode 0: White
1488:   if (uStrobeMode < 0.5) {
1489:     color = vec3(0.85, 0.9, 1.0);
1490:   }
1491:   // Mode 1: Color (use palette)
1492:   else if (uStrobeMode < 1.5) {
1493:     color = palette(0.5);
1494:   }
1495:   // Mode 2: Rainbow
1496:   else if (uStrobeMode < 2.5) {
1497:     color = palette(fract(t * 0.2));
1498:   }
1499:   // Mode 3: Invert (handled in main)
1500:   else {
1501:     color = vec3(1.0);
1502:   }
1503: 
1504:   // Pattern variation
1505:   // Pattern 0: Solid (no modification)
1506:   // Pattern 1: Scanlines
1507:   if (uStrobePattern > 0.5 && uStrobePattern < 1.5) {
1508:     flash *= step(0.5, fract(uv.y * 100.0));
1509:   }
1510:   // Pattern 2: Radial
1511:   else if (uStrobePattern > 1.5) {
1512:     flash *= 1.0 - smoothstep(0.0, 0.7, length(uv - 0.5) * 2.0);
1513:   }
1514: 
1515:   return color * flash * uStrobeOpacity;
1516: }
1517: 
1518: vec3 shapeBurst(vec2 uv, float t) {
1519:   vec2 centered = uv - 0.5;
1520:   centered.x *= uAspect;
1521:   vec3 color = vec3(0.0);
1522: 
1523:   for (int i = 0; i < 8; i++) {
1524:     if (uBurstActives[i] < 0.5) continue;
1525: 
1526:     float age = t - uBurstSpawnTimes[i];
1527:     if (age < 0.0) continue;
1528: 
1529:     float size = uShapeBurstStartSize + age * uShapeBurstExpandSpeed;
1530:     if (size > uShapeBurstMaxSize) continue;
1531: 
1532:     float fadeT = size / uShapeBurstMaxSize;
1533:     float opacity = 1.0;
1534: 
1535:     // Fade mode: 0=size, 1=opacity, 2=both
1536:     if (uShapeBurstFadeMode > 0.5) {
1537:       opacity = 1.0 - fadeT;
1538:     }
1539: 
1540:     float dist = length(centered);
1541:     float shape = 0.0;
1542: 
1543:     // Shape 0: Ring
1544:     if (uShapeBurstShape < 0.5) {
1545:       shape = smoothstep(uShapeBurstThickness, 0.0, abs(dist - size * 0.5));
1546:     }
1547:     // Shape 1: Circle (filled)
1548:     else if (uShapeBurstShape < 1.5) {
1549:       shape = smoothstep(size * 0.5 + uShapeBurstThickness, size * 0.5, dist);
1550:     }
1551:     // Shape 2: Hexagon
1552:     else if (uShapeBurstShape < 2.5) {
1553:       float hex = sdHexagon(centered, size * 0.5);
1554:       shape = smoothstep(uShapeBurstThickness, 0.0, abs(hex));
1555:     }
1556:     // Shape 3: Star
1557:     else if (uShapeBurstShape < 3.5) {
1558:       float star = sdStar(centered, size * 0.5, 5, 2.5);
1559:       shape = smoothstep(uShapeBurstThickness, 0.0, abs(star));
1560:     }
1561:     // Shape 4: Triangle
1562:     else {
1563:       float tri = sdEquilateralTriangle(centered, size * 0.5);
1564:       shape = smoothstep(uShapeBurstThickness, 0.0, abs(tri));
1565:     }
1566: 
1567:     vec3 burstColor = palette(fract(float(i) * 0.15 + age * 0.5));
1568:     color += burstColor * shape * opacity;
1569:   }
1570: 
1571:   return color * uShapeBurstOpacity;
1572: }
1573: 
1574: vec3 gridTunnel(vec2 uv, float t, float audio) {
1575:   float speed = uGridTunnelSpeed * (1.0 + audio * uGridTunnelAudioReact);
1576:   vec3 color = vec3(0.0);
1577: 
1578:   // Mode 0: Floor
1579:   if (uGridTunnelMode < 0.5) {
1580:     float y = uv.y - uGridTunnelHorizonY;
1581:     if (abs(y) < 0.01) return color;
1582: 
1583:     float z = uGridTunnelPerspective / (abs(y) + 0.01);
1584:     float x = (uv.x - 0.5) * z;
1585: 
1586:     float gridX = fract(x * uGridTunnelGridSize * 0.1);
1587:     float gridZ = fract(z * uGridTunnelGridSize * 0.1 - t * speed);
1588: 
1589:     float lineX = smoothstep(uGridTunnelLineWidth, 0.0, min(gridX, 1.0 - gridX));
1590:     float lineZ = smoothstep(uGridTunnelLineWidth, 0.0, min(gridZ, 1.0 - gridZ));
1591:     float grid = max(lineX, lineZ);
1592: 
1593:     float fade = exp(-abs(y) * 3.0);
1594:     float horizon = smoothstep(0.0, 0.1, abs(y));
1595: 
1596:     vec3 gridColor = palette(0.6);
1597:     color = gridColor * grid * fade * horizon * (1.0 + uGridTunnelGlow);
1598:   }
1599:   // Mode 1: Tunnel
1600:   else if (uGridTunnelMode < 1.5) {
1601:     vec2 centered = uv - 0.5;
1602:     centered.x *= uAspect;
1603: 
1604:     float r = length(centered);
1605:     float angle = atan(centered.y, centered.x);
1606: 
1607:     float z = uGridTunnelPerspective / (r + 0.01);
1608:     z = fract(z * 0.2 - t * speed * 0.5);
1609: 
1610:     float angleGrid = fract(angle / 6.28318 * uGridTunnelGridSize);
1611: 
1612:     float lineR = smoothstep(uGridTunnelLineWidth * 2.0, 0.0, min(z, 1.0 - z));
1613:     float lineA = smoothstep(uGridTunnelLineWidth, 0.0, min(angleGrid, 1.0 - angleGrid));
1614:     float grid = max(lineR, lineA);
1615: 
1616:     float fade = 1.0 - smoothstep(0.0, 0.5, r);
1617: 
1618:     vec3 gridColor = palette(0.7);
1619:     color = gridColor * grid * fade * (1.0 + uGridTunnelGlow);
1620:   }
1621:   // Mode 2: Box
1622:   else {
1623:     vec2 centered = (uv - 0.5) * 2.0;
1624:     centered.x *= uAspect;
1625: 
1626:     // Create a box perspective effect
1627:     float z = fract(t * speed * 0.5);
1628:     float scale = 1.0 + z * 2.0;
1629:     vec2 scaled = centered * scale;
1630: 
1631:     // Box edges
1632:     float boxDist = max(abs(scaled.x), abs(scaled.y));
1633:     float boxLine = smoothstep(uGridTunnelLineWidth * scale, 0.0, abs(boxDist - 1.0));
1634: 
1635:     // Grid on surfaces
1636:     float gridX = fract(scaled.x * uGridTunnelGridSize * 0.2);
1637:     float gridY = fract(scaled.y * uGridTunnelGridSize * 0.2);
1638:     float gridLine = smoothstep(uGridTunnelLineWidth, 0.0, min(gridX, 1.0 - gridX));
1639:     gridLine = max(gridLine, smoothstep(uGridTunnelLineWidth, 0.0, min(gridY, 1.0 - gridY)));
1640: 
1641:     float fade = 1.0 - z;
1642: 
1643:     vec3 gridColor = palette(0.5 + z * 0.3);
1644:     color = gridColor * (boxLine + gridLine * 0.5) * fade * (1.0 + uGridTunnelGlow);
1645:   }
1646: 
1647:   return color * uGridTunnelOpacity;
1648: }
1649: // --- End EDM Generator Functions ---
1650: 
1651: 
1652: 
1653: 
1654: void main() {
1655:   vec2 uv = vUv;
1656:   float low = 0.0;
1657:   for (int i = 0; i < 8; i += 1) { low += uSpectrum[i]; }
1658:   low /= 8.0;
1659:   float mid = 0.0;
1660:   for (int i = 8; i < 24; i += 1) { mid += uSpectrum[i]; }
1661:   mid /= 16.0;
1662:   float high = 0.0;
1663:   for (int i = 24; i < 64; i += 1) { high += uSpectrum[i]; }
1664:   high /= 40.0;
1665:   
1666:   // Apply Motion Template Distortion
1667:   if (uMotionTemplate > 0.5 && uMotionTemplate < 1.5) { // Radial
1668:       vec2 centered = uv * 2.0 - 1.0;
1669:       float r = length(centered);
1670:       float a = atan(centered.y, centered.x);
1671:       
1672:       // Radial Core Semantic: Kick drives compression
1673:       if (uMotionTemplate > 0.9 && uMotionTemplate < 1.1) {
1674:           r *= (1.0 + low * 0.4); // Push outward on kick
1675:       }
1676:       
1677:       uv = vec2(r, a / 6.2831 + 0.5);
1678:   } else if (uMotionTemplate > 1.5 && uMotionTemplate < 2.5) { // Vortex
1679:       vec2 centered = uv * 2.0 - 1.0;
1680:       float r = length(centered);
1681:       float torque = uTime * 0.2 + mid * 2.5; // Torque driven by mids
1682:       float a = atan(centered.y, centered.x) + r * 3.1415 * (1.0 + sin(torque));
1683:       uv = vec2(cos(a), sin(a)) * r * 0.5 + 0.5;
1684:   } else if (uMotionTemplate > 4.5 && uMotionTemplate < 5.5) { // Organic
1685:       vec2 noiseOffset = vec2(fbm(uv * 2.5 + uTime * 0.15), fbm(uv * 3.0 - uTime * 0.1));
1686:       uv += (noiseOffset - 0.5) * 0.12;
1687:   } else if (uMotionTemplate > 7.5) { // Vapor
1688:       uv.y = 1.0 / (uv.y + 0.5); 
1689:       uv.x = (uv.x - 0.5) * uv.y + 0.5;
1690:       uv.y += uTime * 0.05; // Scents of movement
1691:   }
1692: 
1693:   // Apply Transition Distortion
1694:   if (uTransitionAmount > 0.01) {
1695:     if (uTransitionType > 1.5 && uTransitionType < 2.5) { // Warp
1696:       vec2 centered = uv * 2.0 - 1.0;
1697:       float dist = length(centered);
1698:       float angle = atan(centered.y, centered.x);
1699:       angle += uTransitionAmount * 3.1415 * (1.0 - dist);
1700:       float zoom = 1.0 - uTransitionAmount * 0.5;
1701:       uv = vec2(cos(angle), sin(angle)) * dist * zoom * 0.5 + 0.5;
1702:     } else if (uTransitionType > 2.5) { // Glitch
1703:       float noiseVal = hash21(vec2(floor(uv.y * 40.0), uTime * 15.0));
1704:       if (noiseVal < uTransitionAmount) {
1705:         uv.x += (hash21(vec2(uTime * 20.0)) - 0.5) * uTransitionAmount * 0.3;
1706:       }
1707:     } else if (uTransitionType > 3.5) { // Dissolve
1708:       float dNoise = noise(uv * 12.0 + uTime * 0.1);
1709:       if (dNoise < uTransitionAmount * 1.2) {
1710:         discard;
1711:       }
1712:     }
1713:   }
1714: 
1715:   vec2 effectUv = kaleidoscope(uv, uKaleidoscope);
1716:   
1717:   // Engine Grammar: Inertial Energy Accumulation
1718:   // We use Time to simulate a decaying energy state that "charges" on audio peaks
1719:   float lowEnergy = pow(low, 2.0 / uEngineElasticity);
1720:   float midEnergy = pow(mid, 1.5 / uEngineElasticity);
1721:   float highEnergy = pow(high, 1.0 / uEngineElasticity);
1722: 
1723:   // Apply Mass/Friction simulation (simulated via smoothing)
1724:   low = mix(low, lowEnergy, 1.0 - uEngineMass);
1725:   mid = mix(mid, midEnergy, 1.0 - uEngineMass);
1726:   high = mix(high, highEnergy, 1.0 - uEngineMass);
1727: 
1728:   low = pow(low, 1.2);
1729:   mid = pow(mid, 1.1);
1730:   high = pow(high, 1.0);
1731: 
1732:   float gravityLens = 0.0;
1733:   float gravityRing = 0.0;
1734:   if (uGravityActive[0] > 0.5 || uGravityActive[1] > 0.5 || uGravityActive[2] > 0.5 || uGravityActive[3] > 0.5 ||
1735:       uGravityActive[4] > 0.5 || uGravityActive[5] > 0.5 || uGravityActive[6] > 0.5 || uGravityActive[7] > 0.5) {
1736:     vec2 centered = effectUv * 2.0 - 1.0;
1737:     vec2 warp = vec2(0.0);
1738:     float ringAcc = 0.0;
1739:     float lens = 0.0;
1740:     float tWarp = uTime * (1.0 - clamp(low, 0.0, 1.0) * 0.25);
1741:     for (int i = 0; i < 8; i += 1) {
1742:       if (uGravityActive[i] < 0.5) continue;
1743:       vec2 well = uGravityPos[i];
1744:       vec2 delta = centered - well;
1745:       float dist = length(delta) + 0.001;
1746:       float inv = uGravityStrength[i] / (dist * dist + 0.12);
1747:       float polarity = uGravityPolarity[i];
1748:       warp += normalize(delta) * inv * -0.08 * polarity;
1749:       float ring = sin(dist * (8.0 + mid * 14.0) - tWarp * 2.2);
1750:       ring *= smoothstep(0.6, 0.05, dist) * (0.4 + high);
1751:       ringAcc += ring * inv;
1752:       lens += inv * 0.2;
1753:     }
1754:     warp *= (1.0 + uGravityCollapse * 0.8);
1755:     effectUv = clamp(effectUv + warp * 0.5, 0.0, 1.0);
1756:     gravityLens = lens;
1757:     gravityRing = ringAcc;
1758:   }
1759:   if (uFeedback > 0.01 || abs(uFeedbackZoom) > 0.01 || abs(uFeedbackRotation) > 0.01) {
1760:     vec2 centered = effectUv * 2.0 - 1.0;
1761:     float radius = length(centered);
1762:     float angle = atan(centered.y, centered.x);
1763:     
1764:     // Twist from amount
1765:     angle += uFeedback * radius * 2.0;
1766:     
1767:     // Explicit rotation
1768:     angle += uFeedbackRotation;
1769:     
1770:     // Zoom/Scale (Zoom in if zoom > 0)
1771:     float zoomFactor = 1.0 - uFeedbackZoom * 0.5;
1772:     float stretch = 1.0 + uFeedback * 0.5;
1773:     float newRadius = pow(radius * zoomFactor, stretch);
1774:     
1775:     effectUv = vec2(cos(angle), sin(angle)) * newRadius * 0.5 + 0.5;
1776:   }
1777:   if (uExpressiveRadialGravity > 0.01) {
1778:     vec2 focus = vec2(uExpressiveRadialFocusX, uExpressiveRadialFocusY);
1779:     vec2 toFocus = focus - effectUv;
1780:     float dist = length(toFocus);
1781:     float radius = mix(0.1, 1.2, clamp(uExpressiveRadialRadius, 0.0, 1.0));
1782:     float strength = uExpressiveRadialGravity * clamp(uExpressiveRadialStrength, 0.0, 1.0);
1783:     float falloff = smoothstep(radius, 0.0, dist);
1784:     vec2 pull = normalize(toFocus + 0.0001) * strength * falloff * 0.12;
1785:     effectUv = clamp(effectUv + pull, 0.0, 1.0);
1786:   }
1787:   vec3 color = vec3(0.02, 0.04, 0.08);
1788:   if (uPlasmaEnabled > 0.5) {
1789:     vec3 plasmaColor = samplePlasma(effectUv, uTime);
1790:     color += plasmaColor * uPlasmaOpacity * uRoleWeights.x;
1791:   }
1792:   if (uPlasmaAssetEnabled > 0.5) {
1793:     vec2 assetUv = effectUv;
1794:     float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uPlasmaAssetAudioReact;
1795:     vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
1796:     centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
1797:     vec4 assetSample = texture(uPlasmaAsset, centeredAssetUv);
1798:     vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
1799:     float alpha = assetSample.a * clamp(uPlasmaOpacity, 0.0, 1.0) * uRoleWeights.x;
1800:     color = applyBlendMode(color, assetColor, uPlasmaAssetBlend, alpha);
1801:   }
1802:   if (uSpectrumEnabled > 0.5) {
1803:     float band = floor(effectUv.x * 64.0);
1804:     int index = int(clamp(band, 0.0, 63.0));
1805:     float amp = uSpectrum[index];
1806:     float trail = uTrailSpectrum[index];
1807:     float bar = step(effectUv.y, amp);
1808:     float trailBar = step(effectUv.y, trail);
1809:     color += palette(amp) * bar * 0.8 * uSpectrumOpacity * uRoleWeights.y;
1810:     if (uPersistence > 0.01) { color += palette(trail) * trailBar * 0.5 * uPersistence * uRoleWeights.y; }
1811:   }
1812:   if (uSpectrumAssetEnabled > 0.5) {
1813:     vec2 assetUv = effectUv;
1814:     float band = floor(assetUv.x * 64.0);
1815:     int specIndex = int(clamp(band, 0.0, 63.0));
1816:     float specVal = uSpectrum[specIndex];
1817:     float audioMod = 1.0 + (specVal * 0.4 + uRms * 0.3) * uSpectrumAssetAudioReact;
1818:     vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
1819:     centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
1820:     vec4 assetSample = texture(uSpectrumAsset, centeredAssetUv);
1821:     vec3 assetColor = assetSample.rgb * (0.8 + audioMod * 0.2);
1822:     float alpha = assetSample.a * clamp(uSpectrumOpacity, 0.0, 1.0) * uRoleWeights.y;
1823:     color = applyBlendMode(color, assetColor, uSpectrumAssetBlend, alpha);
1824:   }
1825:   if (uMediaEnabled > 0.5 && uMediaAssetEnabled > 0.5) {
1826:     vec2 assetUv = effectUv;
1827:     float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uMediaAssetAudioReact;
1828:     vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
1829:     centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
1830:     vec4 assetSample = texture(uMediaAsset, centeredAssetUv);
1831:     vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
1832:     float alpha = assetSample.a * clamp(uMediaOpacity, 0.0, 1.0) * uRoleWeights.y;
1833:     color = applyBlendMode(color, assetColor, uMediaAssetBlend, alpha);
1834:   }
1835:   if (uMediaEnabled > 0.5) {
1836:     for (int i = 0; i < 8; i += 1) {
1837:       float activeAmt = uMediaBurstActive[i];
1838:       if (activeAmt <= 0.01) continue;
1839:       vec2 delta = effectUv - uMediaBurstPos[i];
1840:       float r = uMediaBurstRadius[i];
1841:       float w = 0.01 + activeAmt * 0.015;
1842:       float type = uMediaBurstType[i];
1843:       float shape = 0.0;
1844:       if (type < 0.5) {
1845:         float dist = length(delta);
1846:         shape = smoothstep(r + w, r, dist) * smoothstep(r, r - w * 2.2, dist);
1847:       } else if (type < 1.5) {
1848:         float t = sdEquilateralTriangle(delta, r);
1849:         shape = smoothstep(w, 0.0, abs(t));
1850:       } else {
1851:         float line = smoothstep(w, 0.0, abs(delta.y)) * smoothstep(r, r - w * 6.0, abs(delta.x));
1852:         shape = line;
1853:       }
1854:       vec3 burstColor = palette(fract(float(i) * 0.17 + uPaletteShift * 0.2));
1855:       color += burstColor * shape * activeAmt * uMediaOpacity * uRoleWeights.y;
1856:     }
1857:   }
1858:   if (uGlyphEnabled > 0.5) {
1859:     vec2 grid = vec2(18.0, 10.0);
1860:     vec2 cell = floor(effectUv * grid);
1861:     vec2 local = fract(effectUv * grid) - 0.5;
1862:     float cellId = cell.x + cell.y * grid.x;
1863:     float band = floor((cell.x / grid.x) * 8.0);
1864:     int bandIndex = int(clamp(band, 0.0, 7.0));
1865:     float bandVal = uSpectrum[bandIndex * 8];
1866:     float complexity = clamp(0.3 + bandVal * 0.8 + uGlyphBeat * 0.4, 0.0, 1.0);
1867:     float seed = uGlyphSeed + cellId * 0.37 + band * 2.1 + floor(uGlyphBeat * 4.0) * 7.0;
1868:     if (uGlyphMode < 0.5) { local.y += (mod(cell.x, 3.0) - 1.0) * (0.08 + bandVal * 0.12); }
1869:     else if (uGlyphMode < 1.5) { local = rotate2d(local, uTime * 0.15 * uGlyphSpeed + cellId * 0.12); }
1870:     else if (uGlyphMode < 2.5) { local += normalize(local + 0.0001) * (uGlyphBeat * 0.35 + bandVal * 0.12); }
1871:     else { local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.6) * 0.2; local.y += (cell.x / grid.x - 0.5) * 0.12; }
1872:     if (uGlyphMode > 2.5) { local.y += (mod(cell.y, 4.0) - 1.5) * 0.06; local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.8) * 0.06; }
1873:     float dist = glyphShape(local, seed, band, complexity);
1874:     float stroke = smoothstep(0.04, 0.0, dist);
1875:     vec3 glyphColor = bandIndex < 2 ? vec3(0.65, 0.8, 0.95) : bandIndex < 4 ? vec3(0.95, 0.75, 0.6) : bandIndex < 6 ? vec3(0.7, 0.9, 0.78) : vec3(0.82, 0.72, 0.95);
1876:     glyphColor *= 0.55 + complexity * 0.75;
1877:     color += glyphColor * stroke * uGlyphOpacity * uRoleWeights.y;
1878:   }
1879:   if (uCrystalEnabled > 0.5) {
1880:     vec2 centered = effectUv * 2.0 - 1.0;
1881:     float alignment = smoothstep(0.2, 0.7, uRms);
1882:     float bassStability = clamp(low * 1.4, 0.0, 1.0);
1883:     float timeScale = uCrystalSpeed > 0.01 ? uCrystalSpeed : 1.0;
1884:     float cell = crystalField(centered, uTime * 0.02 * timeScale + uCrystalMode * 2.0, mix(4.0, 10.0, bassStability) * (uCrystalScale > 0.01 ? uCrystalScale : 1.0));
1885:     float shard = smoothstep(0.22, 0.02, cell);
1886:     float growth = mix(0.35, 0.9, alignment) + mid * 0.2;
1887:     vec3 base = vec3(0.55, 0.75, 0.95), core = vec3(0.25, 0.5, 0.9), caustic = vec3(0.9, 0.95, 1.0);
1888:     vec3 crystal = mix(base, core, (1.0 - cell) * (0.6 + bassStability * 0.6));
1889:     crystal += caustic * smoothstep(0.1, 0.0, cell - high * 0.05) * clamp(uPeak - uRms, 0.0, 1.0) * (0.6 + high);
1890:     crystal *= growth + (uCrystalMode < 0.5 ? 0.15 : uCrystalMode < 1.5 ? 0.35 : uCrystalMode < 2.5 ? 0.7 : 0.05);
1891:     crystal *= 0.4 + (1.0 - clamp(uCrystalBrittleness, 0.0, 1.0)) * 0.6;
1892:     color += crystal * shard * uCrystalOpacity * uRoleWeights.y;
1893:   }
1894:   if (uInkEnabled > 0.5) {
1895:     vec2 centered = effectUv * 2.0 - 1.0;
1896:     float flowScale = mix(1.5, 4.0, uRms) * uInkScale;
1897:     vec2 flow = vec2(sin(centered.y * flowScale + uTime * 0.4 * uInkSpeed + uPeak * 1.2), cos(centered.x * flowScale - uTime * 0.35 * uInkSpeed + uRms));
1898:     flow += vec2(-centered.y, centered.x) * (0.25 + uPeak * 0.5);
1899:     if (uGlyphBeat > 0.1) flow = vec2(flow.y, -flow.x);
1900:     vec2 inkUv = effectUv + flow * 0.08;
1901:     float stroke = smoothstep(0.6, 0.0, abs(sin((inkUv.x + inkUv.y) * 18.0 * uInkScale + uTime * 0.6 * uInkSpeed))) * (0.4 + uInkPressure * 0.8);
1902:     vec3 inkColor = uInkBrush < 0.5 ? vec3(0.12, 0.08, 0.06) : uInkBrush < 1.5 ? vec3(0.2, 0.15, 0.1) : vec3(0.1, 0.85, 0.95);
1903:     if (uInkBrush > 0.5 && uInkBrush < 1.5) stroke *= 0.6 + abs(sin(inkUv.x * 12.0 + uTime * 0.4 * uInkSpeed)) * 0.6;
1904:     color += inkColor * stroke * mix(0.3, 0.9, uInkLifespan) * uInkOpacity * uRoleWeights.z;
1905:   }
1906:   if (uTopoEnabled > 0.5) {
1907:     vec2 centered = (effectUv * 2.0 - 1.0) * (2.0 - clamp(uTopoScale, 0.1, 1.9));
1908:     float travel = uTopoTravel + uTopoPlate * 0.4;
1909:     vec2 flow = centered + vec2(travel * 0.4, travel * 0.2);
1910:     float elevation = (low * 0.6 + mid * 0.3 + high * 0.1) * uTopoElevation;
1911:     float terrain = (abs(sin(flow.x * 2.4 + travel) + cos(flow.y * 2.2 - travel)) * 0.35) * (0.6 + elevation) + elevation * 0.6;
1912:     terrain += uTopoQuake * 0.6 * sin(flow.x * 6.0 + uTime * 1.4);
1913:     terrain -= uTopoSlide * 0.5 * smoothstep(0.2, 0.9, terrain);
1914:     float mask = smoothstep(0.12, 0.02, abs(sin(terrain * mix(6.0, 18.0, high))) * mix(0.2, 1.0, mid));
1915:     color += mix(vec3(0.18, 0.28, 0.35), vec3(0.4, 0.6, 0.7), clamp(terrain, 0.0, 1.0)) * mask * uTopoOpacity * uRoleWeights.z;
1916:   }
1917:   if (uWeatherEnabled > 0.5) {
1918:     vec2 centered = effectUv * 2.0 - 1.0;
1919:     float pressure = low * 1.2 + uWeatherIntensity * 0.4;
1920:     vec2 flow = vec2(sin(centered.y * 1.6 + uTime * 0.2 * uWeatherSpeed), cos(centered.x * 1.4 - uTime * 0.18 * uWeatherSpeed));
1921:     flow += vec2(-centered.y, centered.x) * (0.2 + (uWeatherMode > 2.5 ? 1.0 : 0.0) * 0.6) * (0.4 + pressure);
1922:     vec2 wUv = effectUv + flow * (0.08 + mid * 1.1 * 0.15);
1923:     float cloud = smoothstep(0.1, 0.7, (sin(wUv.x * 3.2 + uTime * 0.1 * uWeatherSpeed) + cos(wUv.y * 2.6 - uTime * 0.08 * uWeatherSpeed)) * 0.35 + pressure);
1924:     vec3 cCol = mix(vec3(0.6, 0.65, 0.7), vec3(0.85, 0.88, 0.9), cloud);
1925:     if (uWeatherMode < 0.5) cCol = mix(cCol, vec3(0.45, 0.55, 0.65), 1.0);
1926:     else if (uWeatherMode < 2.5) cCol = mix(cCol, vec3(0.7, 0.75, 0.8), 1.0);
1927:     float pHigh = high * 1.2 + uWeatherIntensity * 0.2;
1928:     float rain = smoothstep(0.6, 0.0, abs(sin((wUv.x + uTime * 0.4 * uWeatherSpeed) * 30.0)) * pHigh) * (uWeatherMode < 0.5 || uWeatherMode > 2.5 ? 1.0 : 0.0);
1929:     float snow = smoothstep(0.65, 0.0, abs(sin((wUv.y - uTime * 0.2 * uWeatherSpeed) * 18.0)) * pHigh) * (uWeatherMode > 0.5 && uWeatherMode < 1.5 ? 1.0 : 0.0);
1930:     color += (cCol * cloud + vec3(0.4, 0.55, 0.8) * rain + vec3(0.8, 0.85, 0.9) * snow + vec3(1.2, 1.1, 0.9) * smoothstep(0.9, 1.0, pHigh) * (uWeatherMode < 0.5 ? 1.0 : 0.0) * uGlyphBeat) * (0.5 + uWeatherIntensity * 0.6) * uWeatherOpacity * uRoleWeights.z;
1931:   }
1932:   if (uPortalEnabled > 0.5) {
1933:     vec2 centered = effectUv * 2.0 - 1.0;
1934:     vec2 warp = vec2(0.0); float ringGlow = 0.0;
1935:     float style = clamp(uPortalStyle, 0.0, 2.0);
1936:     float ringWidth = mix(0.02, 0.05, step(0.5, style));
1937:     ringWidth = mix(ringWidth, 0.08, step(1.5, style));
1938:     for (int i = 0; i < 4; i += 1) {
1939:       if (uPortalActive[i] < 0.5) continue;
1940:       vec2 delta = centered - uPortalPos[i]; float dist = length(delta), rad = uPortalRadius[i];
1941:       ringGlow += smoothstep(rad + ringWidth, rad, dist) * smoothstep(rad - ringWidth, rad - ringWidth * 2.5, dist);
1942:       warp += normalize(delta + 0.0001) * (rad - dist) * mix(0.06, 0.12, step(1.5, style));
1943:     }
1944:     effectUv = clamp(effectUv + warp * mix(0.45, 0.6, step(0.5, style)), 0.0, 1.0);
1945:     vec3 baseCol = vec3(0.2, 0.6, 0.9);
1946:     if (style > 0.5 && style < 1.5) baseCol = vec3(0.7, 0.35, 0.95);
1947:     if (style >= 1.5) baseCol = vec3(0.2, 0.9, 0.55);
1948:     color += (baseCol + vec3(0.2, 0.1, 0.3) * uPortalShift) * ringGlow * uPortalOpacity * uRoleWeights.z;
1949:   }
1950:   if (uOscilloEnabled > 0.5) {
1951:     vec2 centered = effectUv * 2.0 - 1.0;
1952:     float rot = uOscilloRotate * 0.6 + uTime * 0.12 * (1.0 - uOscilloFreeze), minDist = 10.0, arcGlow = 0.0;
1953:     for (int i = 0; i < 64; i += 1) {
1954:       float t = float(i) / 63.0, rad = 0.28 + oscilloSample(t) * 0.22 + uRms * 0.12;
1955:       vec2 p = rotate2d(vec2(cos(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35)), sin(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35))) * rad, rot);
1956:       minDist = min(minDist, length(centered - p));
1957:       arcGlow += smoothstep(0.08, 0.0, abs(length(centered) - (rad + 0.06 * sin(t * 12.0 + uTime * 0.3)))) * 0.2;
1958:     }
1959:     color += (mix(vec3(0.95, 0.82, 0.6), vec3(0.6, 0.8, 1.0), uSpectrum[28]) * (0.6 + smoothstep(0.2, 0.7, uRms) * 0.5) + mix(vec3(0.95, 0.5, 0.2), vec3(0.7, 0.9, 1.0), uSpectrum[8]) * (0.2 + uPeak * 0.6) + vec3(0.2, 0.15, 0.4) * arcGlow) * (smoothstep(0.07, 0.0, minDist) + smoothstep(0.18, 0.0, minDist) * 0.35 + arcGlow) * uOscilloOpacity * uRoleWeights.y;
1960:   }
1961:   if (gravityLens > 0.0 || gravityRing > 0.0) color += (vec3(0.08, 0.12, 0.2) * gravityLens + vec3(0.2, 0.35, 0.5) * gravityRing * (0.4 + high)) * uRoleWeights.z;
1962:   if (uOrigamiEnabled > 0.5) {
1963:     vec2 centered = effectUv * 2.0 - 1.0;
1964:     float sharp = mix(0.12, 0.02, clamp(uOrigamiFoldSharpness, 0.0, 1.0));
1965:     float foldField = ( (1.0 - smoothstep(0.0, sharp, min(abs(sin((centered.x * 0.9 + centered.y * 0.4) * mix(2.5, 7.5, low) + uTime * 0.35 * uOrigamiSpeed)), abs(sin((centered.x * -0.4 + centered.y * 0.9) * mix(2.5, 7.5, low) + 1.7))))) * (0.6 + low) + (1.0 - smoothstep(0.0, sharp * 0.8, abs(sin(centered.x * mix(6.0, 18.0, mid))) * abs(sin(centered.y * mix(6.0, 18.0, mid))))) * (0.4 + mid) ) * (0.6 + uOrigamiFoldSharpness) + sin(centered.x * mix(18.0, 60.0, high) + uTime * uOrigamiSpeed) * sin(centered.y * mix(18.0, 60.0, high) - uTime * 0.8 * uOrigamiSpeed) * high * 0.3;
1966:     float displacement = (foldField + (step(1.5, uOrigamiFoldState) * (1.0 - step(2.5, uOrigamiFoldState)) - step(2.5, uOrigamiFoldState)) * smoothstep(0.9, 0.0, length(centered)) * (0.4 + low)) * (uOrigamiFoldState < 0.5 ? 1.0 : (uOrigamiFoldState < 1.5 ? -1.0 : (uOrigamiFoldState < 2.5 ? 1.0 : -1.0)));
1967:     vec3 normal = normalize(vec3(-dFdx(displacement), -dFdy(displacement), 1.0));
1968:     float diff = clamp(dot(normal, normalize(vec3(-0.4, 0.6, 0.9))), 0.0, 1.0);
1969:     float grain = hash21(effectUv * 420.0) * 0.12 + hash21(effectUv * 1200.0) * 0.06;
1970:     vec3 origamiCol = clamp(
1971:       vec3(0.78, 0.74, 0.7) * (0.55 + diff * 0.35)
1972:         + smoothstep(0.2, 0.75, foldField) * vec3(0.12, 0.1, 0.08)
1973:         + vec3(sin((effectUv.y + grain) * 900.0) * 0.03 + grain) * 0.12
1974:         - smoothstep(0.7, 0.98, abs(sin(centered.x * mix(18.0, 60.0, high) + uTime * uOrigamiSpeed)
1975:             * sin(centered.y * mix(18.0, 60.0, high) - uTime * 0.8 * uOrigamiSpeed)))
1976:           * high * (0.5 + grain) * vec3(0.18, 0.12, 0.08),
1977:       0.0,
1978:       1.0
1979:     );
1980:     origamiCol = mix(origamiCol, origamiCol * 0.72, 0.35);
1981:     color = applyBlendMode(
1982:       color,
1983:       origamiCol,
1984:       4.0,
1985:       clamp(uOrigamiOpacity, 0.0, 1.0) * 0.8 * uRoleWeights.y
1986:     );
1987:   }
1988:   if (uParticlesEnabled > 0.5) color += vec3(0.2, 0.7, 1.0) * particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize) * uParticleGlow * (0.5 + uRms * 0.8) * uRoleWeights.z;
1989:   if (uSdfEnabled > 0.5) {
1990:     vec2 centered = effectUv * 2.0 - 1.0;
1991:     if (uAdvancedSdfEnabled > 0.5) {
1992:       vec2 uv = centered * vec2(uAspect, 1.0);
1993:       vec3 ro = uCameraPos;
1994:       vec3 rd = getRayDirection(uv, ro, uCameraTarget, uCameraFov);
1995:       float t = 0.0; vec2 res = vec2(0.0); bool hit = false;
1996:       for (int i = 0; i < 64; i++) {
1997:         vec3 p = ro + rd * t; res = advancedSdfMap(p); 
1998:         if (res.x < 0.001) { hit = true; break; }
1999:         if (t > 10.0) break;
2000:         t += res.x;
2001:       }
2002:       if (hit) {
2003:         vec3 p = ro + rd * t, n = calcSdfNormal(p), l = normalize(uSdfLightDir);
2004:         float diff = max(dot(n, l), 0.0) * uSdfLightIntensity;
2005:         float amb = 0.2;
2006:         float shadow = uSdfShadowsEnabled > 0.5 ? calcSdfShadow(p, l, 8.0) : 1.0;
2007:         float ao = uSdfAoEnabled > 0.5 ? calcSdfAO(p, n) : 1.0;
2008:         vec3 lighting = uSdfLightColor * (diff * shadow + amb) * ao;
2009:         float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0) * 0.5 * shadow;
2010:         
2011:         // Dynamic sampling based on internal source
2012:         vec3 baseCol = getSdfColor(res.y);
2013:         if (uInternalSource > 0.5) {
2014:             float sampleVal = getWaveform(fract(res.y * 0.123 + uTime * 0.1));
2015:             baseCol = mix(baseCol, vec3(sampleVal), 0.5);
2016:         }
2017:         
2018:         baseCol *= uSdfColor;
2019:         color += (baseCol * lighting + spec + smoothstep(0.1, 0.0, res.x) * uSdfGlow) * uSdfFill * uRoleWeights.y;
2020:       }
2021:     } else {
2022:       centered = rotate2d(centered, uSdfRotation); 
2023:       float scale = mix(0.2, 0.9, uSdfScale);
2024:       float sdfValue;
2025:       if (uSdfShape < 0.5) sdfValue = sdCircle(centered, scale);
2026:       else if (uSdfShape < 1.5) sdfValue = sdBox(centered, vec2(scale));
2027:       else if (uSdfShape < 2.5) sdfValue = sdEquilateralTriangle(centered, scale);
2028:       else if (uSdfShape < 3.5) sdfValue = sdHexagon(centered, scale);
2029:       else if (uSdfShape < 4.5) sdfValue = sdStar(centered, scale, 5, 2.0);
2030:       else sdfValue = sdRing(centered, scale, uSdfEdge * 0.5);
2031:       
2032:       color += uSdfColor * max(smoothstep(0.02, -0.02, sdfValue) * uSdfFill, smoothstep(uSdfEdge + 0.02, 0.0, abs(sdfValue)) * uSdfGlow) * (0.85 + uPeak * 0.6) * uRoleWeights.y;
2033:     }
2034:   }
2035: 
2036:   // --- Rock Generators ---
2037:   if (uLightningEnabled > 0.5) {
2038:     float lightningVal = lightningBolt(effectUv, uTime, high);
2039:     vec3 lightningCol = vec3(0.8, 0.9, 1.0); // Default blue-white
2040:     if (uLightningColor > 0.5 && uLightningColor < 1.5) lightningCol = vec3(1.0, 0.8, 0.2); // Yellow
2041:     else if (uLightningColor > 1.5) lightningCol = vec3(0.8, 0.2, 1.0); // Purple
2042:     
2043:     color += lightningCol * lightningVal * uRoleWeights.y;
2044:   }
2045:   
2046:   if (uAnalogOscilloEnabled > 0.5) {
2047:     float oscVal = analogOscillo(effectUv, uTime, mid);
2048:     vec3 oscCol = vec3(1.0);
2049:     if (uAnalogOscilloColor > 0.5 && uAnalogOscilloColor < 1.5) oscCol = vec3(1.0, 0.2, 0.1); // Red
2050:     else if (uAnalogOscilloColor > 1.5) oscCol = vec3(0.2, 1.0, 0.2); // Green
2051:     
2052:     color += oscCol * oscVal * uRoleWeights.x;
2053:   }
2054:   
2055:   if (uGlitchScanlineEnabled > 0.5) {
2056:     color += glitchScanline(effectUv, uTime, low) * uRoleWeights.z;
2057:   }
2058:   
2059:   // Speaker cone distortion applied to future layers if I were processing texture, 
2060:   // but here I'll just modulate color slightly to show it exists or maybe rely on it being used earlier?
2061:   // Actually, I should have applied it to effectUv earlier.
2062:   // For now, let's just make it affect the background slightly if enabled.
2063:   if (uSpeakerConeEnabled > 0.5) {
2064:      vec2 distorted = speakerCone(effectUv, low);
2065:      float dist = length(distorted - 0.5);
2066:      float ring = smoothstep(0.02, 0.0, abs(dist - 0.4)) * uSpeakerConeOpacity;
2067:      color += vec3(0.2, 0.0, 0.0) * ring * uRoleWeights.z;
2068:   }
2069: 
2070:   if (uLaserStarfieldEnabled > 0.5) {
2071:     color += laserStarfield(effectUv, uTime, high) * uRoleWeights.x;
2072:   }
2073:   if (uPulsingRibbonsEnabled > 0.5) {
2074:     color += pulsingRibbons(effectUv, uTime, mid) * uRoleWeights.y;
2075:   }
2076:   if (uElectricArcEnabled > 0.5) {
2077:     color += electricArc(effectUv, uTime, mid) * uRoleWeights.z;
2078:   }
2079:   if (uPyroBurstEnabled > 0.5) {
2080:     color += pyroBurst(effectUv, uTime, uPeak) * uRoleWeights.y;
2081:   }
2082:   if (uGeoWireframeEnabled > 0.5) {
2083:     color += geoWireframe(effectUv, uTime, low) * uRoleWeights.x;
2084:   }
2085:   if (uSignalNoiseEnabled > 0.5) {
2086:     color += signalNoise(effectUv, uTime) * uRoleWeights.z;
2087:   }
2088: 
2089:   if (uWormholeEnabled > 0.5) {
2090:     color += infiniteWormhole(effectUv, uTime, low) * uRoleWeights.x;
2091:   }
2092:   if (uRibbonTunnelEnabled > 0.5) {
2093:     color += ribbonTunnel(effectUv, uTime, mid) * uRoleWeights.y;
2094:   }
2095:   if (uFractalTunnelEnabled > 0.5) {
2096:     color += fractalTunnel(effectUv, uTime, low) * uRoleWeights.x;
2097:   }
2098:   if (uCircuitConduitEnabled > 0.5) {
2099:     color += circuitConduit(effectUv, uTime, low) * uRoleWeights.z;
2100:   }
2101: 
2102:   if (uAuraPortalEnabled > 0.5) {
2103:     color += auraPortal(effectUv, uTime, low) * uRoleWeights.x;
2104:   }
2105:   if (uFreqTerrainEnabled > 0.5) {
2106:     color += frequencyTerrain(effectUv, uTime, mid) * uRoleWeights.y;
2107:   }
2108:   if (uDataStreamEnabled > 0.5) {
2109:     color += dataStream(effectUv, uTime, low) * uRoleWeights.z;
2110:   }
2111:   if (uCausticLiquidEnabled > 0.5) {
2112:     color += causticLiquid(effectUv, uTime, mid) * uRoleWeights.x;
2113:   }
2114:   if (uShimmerVeilEnabled > 0.5) {
2115:     color += shimmerVeil(effectUv, uTime, high) * uRoleWeights.y;
2116:   }
2117: 
2118:   // --- New 31 Generators Accumulation ---
2119:   if (uNebulaCloudEnabled > 0.5) color += nebulaCloud(effectUv, uTime, high) * uRoleWeights.z;
2120:   if (uCircuitBoardEnabled > 0.5) color += circuitBoard(effectUv, uTime, mid) * uRoleWeights.z;
2121:   if (uLorenzAttractorEnabled > 0.5) color += lorenzAttractor(effectUv, uTime, low) * uRoleWeights.y;
2122:   if (uMandalaSpinnerEnabled > 0.5) color += mandalaSpinner(effectUv, uTime, mid) * uRoleWeights.y;
2123:   if (uStarburstGalaxyEnabled > 0.5) color += starburstGalaxy(effectUv, uTime, high) * uRoleWeights.y;
2124:   if (uDigitalRainV2Enabled > 0.5) color += digitalRainV2(effectUv, uTime, low) * uRoleWeights.z;
2125:   if (uLavaFlowEnabled > 0.5) color += lavaFlow(effectUv, uTime, low) * uRoleWeights.z;
2126:   if (uCrystalGrowthEnabled > 0.5) color += crystalGrowth(effectUv, uTime, high) * uRoleWeights.z;
2127:   if (uTechnoGridEnabled > 0.5) color += technoGrid3D(effectUv, uTime, low) * uRoleWeights.z;
2128:   if (uMagneticFieldEnabled > 0.5) color += magneticField(effectUv, uTime, high) * uRoleWeights.z;
2129:   if (uPrismShardsEnabled > 0.5) color += prismShards(effectUv, uTime, high) * uRoleWeights.y;
2130:   if (uNeuralNetEnabled > 0.5) color += neuralNet(effectUv, uTime, mid) * uRoleWeights.z;
2131:   if (uAuroraChordEnabled > 0.5) color += auroraChord(effectUv, uTime, mid) * uRoleWeights.z;
2132:   if (uVhsGlitchEnabled > 0.5) color += vhsGlitch(effectUv, uTime, low) * uRoleWeights.z;
2133:   if (uMoirePatternEnabled > 0.5) color += moirePattern(effectUv, uTime, high) * uRoleWeights.y;
2134:   if (uHypercubeEnabled > 0.5) color += hypercube(effectUv, uTime, mid) * uRoleWeights.x;
2135:   if (uFluidSwirlEnabled > 0.5) color += fluidSwirl(effectUv, uTime, mid) * uRoleWeights.z;
2136:   if (uAsciiStreamEnabled > 0.5) color += asciiStream(effectUv, uTime, high) * uRoleWeights.z;
2137:   if (uRetroWaveEnabled > 0.5) color += retroWave(effectUv, uTime, low) * uRoleWeights.x;
2138:   if (uBubblePopEnabled > 0.5) color += bubblePop(effectUv, uTime, uPeak) * uRoleWeights.y;
2139:   if (uSoundWave3DEnabled > 0.5) color += soundWave3D(effectUv, uTime, mid) * uRoleWeights.y;
2140:   if (uParticleVortexEnabled > 0.5) color += particleVortex(effectUv, uTime, low) * uRoleWeights.z;
2141:   if (uGlowWormsEnabled > 0.5) color += glowWorms(effectUv, uTime, mid) * uRoleWeights.z;
2142:   if (uMirrorMazeEnabled > 0.5) color += mirrorMaze(effectUv, uTime, high) * uRoleWeights.y;
2143:   if (uPulseHeartEnabled > 0.5) color += pulseHeart(effectUv, uTime, low) * uRoleWeights.x;
2144:   if (uDataShardsEnabled > 0.5) color += dataShards(effectUv, uTime, high) * uRoleWeights.z;
2145:   if (uHexCellEnabled > 0.5) color += hexCell(effectUv, uTime, mid) * uRoleWeights.z;
2146:   if (uPlasmaBallEnabled > 0.5) color += plasmaBall(effectUv, uTime, uPeak) * uRoleWeights.z;
2147:   if (uWarpDriveEnabled > 0.5) color += warpDrive(effectUv, uTime, high) * uRoleWeights.x;
2148:   if (uVisualFeedbackEnabled > 0.5) color += visualFeedback(effectUv, uTime, mid) * uRoleWeights.y;
2149:   if (uMyceliumGrowthEnabled > 0.5) color += myceliumGrowth(effectUv, uTime, mid) * uRoleWeights.z;
2150:   // --- End New 31 Generators ---
2151: 
2152:   // --- EDM Generators ---
2153:   // Laser Beam Generator
2154:   if (uLaserEnabled > 0.5) {
2155:     float audio = uRms * 0.5 + uPeak * 0.5;
2156:     color += laserBeam(effectUv, uTime, audio) * uRoleWeights.y;
2157:   }
2158: 
2159:   // Grid Tunnel Generator
2160:   if (uGridTunnelEnabled > 0.5) {
2161:     float audio = low; // Bass drives grid
2162:     color += gridTunnel(effectUv, uTime, audio) * uRoleWeights.z;
2163:   }
2164: 
2165:   // Shape Burst Generator
2166:   if (uShapeBurstEnabled > 0.5) {
2167:     color += shapeBurst(effectUv, uTime) * uRoleWeights.y;
2168:   }
2169: 
2170:   // Strobe Flash Effect (added last for maximum impact)
2171:   if (uStrobeEnabled > 0.5) {
2172:     float audio = uRms * 0.3 + uPeak * 0.7;
2173:     vec3 strobeCol = strobeFlash(effectUv, uTime, audio, uPeak);
2174:     // Mode 3: Invert - invert colors instead of adding
2175:     if (uStrobeMode > 2.5 && strobeCol.r > 0.1) {
2176:       color = vec3(1.0) - color;
2177:     } else {
2178:       color += strobeCol;
2179:     }
2180:   }
2181:   // --- End EDM Generators ---
2182: 
2183:   if (uStrobeEnabled > 0.5) {
2184:     color += vec3(uStrobe * 1.5);
2185:   }
2186:   if (
2187:     uPlasmaEnabled > 0.5 ||
2188:     uSpectrumEnabled > 0.5 ||
2189:     uInkEnabled > 0.5 ||
2190:     uTopoEnabled > 0.5 ||
2191:     uPortalEnabled > 0.5 ||
2192:     uOscilloEnabled > 0.5 ||
2193:     uParticlesEnabled > 0.5
2194:   ) {
2195:     color += vec3(uPeak * 0.2, uRms * 0.5, uRms * 0.8);
2196:   }
2197: 
2198:   // Opinionated Engine Glow (HDR-style accumulation)
2199:   if (uEffectsEnabled > 0.5) {
2200:       vec3 glow = pow(color, vec3(2.2)) * uBloom * uMaxBloom;
2201:       glow *= (0.7 + high * 0.5); // Boost glow based on spectral energy
2202:       color += glow;
2203:       
2204:       if (uForceFeedback > 0.5) {
2205:           color = mix(color, color * color, 0.15 * low); // Organic feedback-like saturation
2206:       }
2207:       
2208:       color = posterize(color, uPosterize);
2209:   }
2210: 
2211:   if (uEffectsEnabled > 0.5 && uChroma > 0.01) color = mix(color, vec3(color.r + uChroma * 0.02, color.g, color.b - uChroma * 0.02), 0.3);
2212:   if (uEffectsEnabled > 0.5 && uBlur > 0.01) color = mix(color, vec3((color.r + color.g + color.b) / 3.0), uBlur * 0.3);
2213:   color = shiftPalette(color, uPaletteShift);
2214:   color = applySaturation(color, uSaturation);
2215:   color = applyContrast(color, uContrast);
2216:   color = color / (vec3(1.0) + color);
2217:   color = pow(color, vec3(1.0 / 1.35));
2218:   color *= uGlobalColor;
2219: 
2220:   // --- Engine Finish (Aesthetic Polish) ---
2221:   // 1. Chromatic Aberration
2222:   if (uEngineCA > 0.01) {
2223:       float ca = uEngineCA * 0.015;
2224:       vec2 dist = uv - 0.5;
2225:       color.r = mix(color.r, color.r + ca * dist.x, 0.5);
2226:       color.b = mix(color.b, color.b - ca * dist.y, 0.5);
2227:   }
2228: 
2229:   // 2. Film Grain
2230:   if (uEngineGrain > 0.01) {
2231:       float grain = hash21(uv + uTime) * uEngineGrain * 0.08;
2232:       color += grain;
2233:   }
2234: 
2235:   // 3. Vignette
2236:   if (uEngineVignette > 0.01) {
2237:       float vig = length(uv - 0.5);
2238:       color *= smoothstep(0.8, 0.2, vig * uEngineVignette);
2239:   }
2240: 
2241:   // --- Engine Signature (Unique Identity) ---
2242:   if (uEngineSignature > 0.5) {
2243:       if (uEngineSignature < 1.5) { // Radial Core: Energy Halo
2244:           float halo = 1.0 - smoothstep(0.3, 0.5, length(uv - 0.5));
2245:           color += color * halo * 0.15 * low;
2246:       } else if (uEngineSignature < 2.5) { // Particle Flow: Organic Grit
2247:           float grit = fbm(uv * 20.0 + uTime * 0.05);
2248:           color = mix(color, color * (0.8 + grit * 0.4), 0.2);
2249:       } else if (uEngineSignature < 3.5) { // Kaleido Pulse: Digital Interference
2250:           float line = step(0.98, fract(uv.y * 100.0 + uTime * 2.0));
2251:           color += vec3(line) * 0.05 * high;
2252:       } else if (uEngineSignature > 3.5) { // Vapor Grid: Retro Scanlines
2253:           float scan = sin(uv.y * 400.0) * 0.04;
2254:           color -= scan;
2255:       }
2256:   }
2257: 
2258:   // Final Safety Check: Prevent retina-burning white-out
2259:   float totalLuma = dot(color, vec3(0.299, 0.587, 0.114));
2260:   if (totalLuma > 0.92) {
2261:       color *= (0.92 / totalLuma);
2262:   }
2263: 
2264:   if (uDebugTint > 0.5) color += vec3(0.02, 0.0, 0.0);
2265:   outColor = vec4(color, 1.0);
2266: }
2267: 