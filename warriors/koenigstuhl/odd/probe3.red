;redcode-odd
;name Probe3
;author Roy
;strategy Finetuning test?
;assert 1


tDecoy    equ    (tWipe+1-996)
tStart    mov    <tDecoy+0,{tDecoy+2
          mov    <tDecoy+3,{tDecoy+5
          mov    <tDecoy+6,{tDecoy+8
          djn.f  tScan+1  ,<tDecoy+10

      for 74
          dat 0,0
      rof

tPtr      dat    100 ,4100
tGate     dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #-14     ,tPtr
          sne.x  *tPtr    ,@tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,@tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#10
tSpl      spl    #0       ,{0
tClr      mov    tEnd     ,>tGate
          djn.f  tClr     ,{tGate
tEnd      dat    >1       ,2-tGate
end    tStart

