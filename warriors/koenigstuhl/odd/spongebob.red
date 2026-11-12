;redcode-94odd
;name Spongebob
;author Roy van Rijn
;assert 1

tPtr      dat    100 ,3100

          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #-12     ,tPtr
          sne.x  *tPtr    ,>tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,<tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#10

tSpl      spl    #0       ,}0
tClr      mov    tEnd     ,>tSelf
          djn.f  tClr     ,{tSelf
tEnd      dat    >1       ,2-tSelf
end tScan
