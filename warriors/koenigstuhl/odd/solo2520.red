;redcode-94odd
;name SoLo2520
;author Roy van Rijn
;strategy Slightly altert solo :-)
;strategy Brought me luck previous round(s)
;assert 1

tPtr      dat    10,2210
tGate     dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #-7      ,tPtr
          sne    *tPtr    ,@tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,@tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#14
tStart    nop    {tClr+1  ,}tEnd
tSpl      spl    #0       ,{0
tClr      mov    tEnd     ,>tGate
          djn.f  0        ,{tGate
tEnd      dat    >0       ,2-tGate
end tScan
