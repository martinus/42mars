;redcode
;name Impatient Darwinian
;author Dave Hillis
;strategy -   Created using RedRace
;strategy -   Evolved paper
;assert 1
 
SPL.A  $ 13, > (474 * CORESIZE) / 800 
MOV.I  { (548 * CORESIZE) / 800, $ (339 * CORESIZE) / 800 
MOV.I  > (663 * CORESIZE) / 800, $ 88 
SPL.BA # 69, > (600 * CORESIZE) / 800 
SPL.BA # (210 * CORESIZE) / 800, < 0 
MOV.I  { -1, < -2 
MOV.I  { 13, { 2 
MOV.I  < -4, { -3 
SPL.A  $ (268 * CORESIZE) / 800, > (344 * CORESIZE) / 800 
MOV.I  < (610 * CORESIZE) / 800, < -31 
MOV.I  $ -1, < -1 
SPL.I  $ -1, > 1 
MOV.I  < 100, $ (382 * CORESIZE) / 800 
MOV.I  > (584 * CORESIZE) / 800, { (362 * CORESIZE) / 800 
MOV.I  < (148 * CORESIZE) / 800, { (417 * CORESIZE) / 800 
MOV.I  > (642 * CORESIZE) / 800, { (369 * CORESIZE) / 800 
MOV.I  < 125, { -13 
DJN.F  $ -1, < (630 * CORESIZE) / 800 
end 0
