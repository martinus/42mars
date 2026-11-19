;redcode
;name Mellow Squid LVII
;author 42evolve
;strategy evolved, island 10 (seed 210), batch 2600
;strategy 146.6 against the 429 warriors of warriors/koenigstuhl/tiny, 100 rounds each
;strategy from run tv/island-10, 18th November 2026, --pushoff value
        ORG     3
        JMP.I   >3, >13
        MOD.I   >-5, >7
        MOV.A   $-271, >-47
        SPL.I   #18, <-264
        MOV.I   }0, >13
        MOV.I   >98, >10
        SPL.I   #-15, >-319
        MOV.I   >-1, >9
        MOV.I   >8, >10
        MOV.I   >-3, $393
        MOV.I   >-1, >-145
        MOD.I   >-2, >7
        MOV.A   $-271, >-47
        SPL.I   #-9, $378
        MOV.I   >0, >13
        DJN.BA  >3, >-297
        JMP.I   }-1, >18
        MOD.BA  }-12, }173
        CMP.I   {148, >239
        JMN.BA  {269, @325
