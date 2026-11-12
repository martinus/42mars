;redcode-odd
;name Probe4
;author Roy
;strategy Yes, good guess :)
;strategy maybe even more extreem? (stripping the warrior)
;assert 1


tPtr      dat    100 ,4100
tGate     dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #-18     ,tPtr
          sne.x  *tPtr    ,@tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,@tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#8
tSpl      spl    #0       ,{0
tClr      mov    tEnd     ,>tGate
          djn.f  tClr     ,{tGate
tEnd      dat    >1       ,2-tGate
end tScan+1    ; added [CCB]

