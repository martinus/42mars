;redcode-94
;name Solo LP again
;author Roy van Rijn
;assert 1

tPtr      dat    100 ,4100-4

tGate     dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #2159+14 ,tPtr
          sne.x  *tPtr    ,>tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,<tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#18

tSpl      spl    #0       ,>0
tClr      mov    tEnd     ,>tGate
          mov    tEnd     ,>tGate
          djn.f  -2       ,>tGate
tEnd      dat    <2667    ,#30
end tScan
