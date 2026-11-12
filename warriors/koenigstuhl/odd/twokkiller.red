;redcode-94m
;name 2k Killer
;author Roy van Rijn
;assert 1
;       CORESIZE 2000
;       MAXPROCESSES 2000
;       MAXCYCLES 20000

tPtr      dat    100 ,(CORESIZE/2+(CORESIZE/20))

aPtr      dat    -14,-10
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  aPtr     ,tPtr
          sne.x  *tPtr    ,>tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,<tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
for (CORESIZE>18000)
          djn    *pScan   ,#2
rof
for (CORESIZE>13000)&&(CORESIZE<18000)
          djn    *pScan   ,#5
rof
for (CORESIZE>7000)&&(CORESIZE<13000)
          djn    *pScan   ,#10
rof
for (CORESIZE<7000)
          djn    *pScan   ,#15
rof

tSpl      spl    #0       ,}0
tClr      mov    tEnd     ,>tSelf
          djn.f  tClr     ,{tSelf
tEnd      dat    >1       ,2-tSelf
end tScan
