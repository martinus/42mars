;redcode-odd
;name Probe1
;author Roy
;strategy HSA scanner to see if paper
;assert 1

tPtr      dat    100 ,4100-4
tGate     dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #-12     ,tPtr
          sne.x  *tPtr    ,@tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,@tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#12
tSpl      spl    #0       ,{0
tClr      mov    tEnd     ,>tGate
          djn.f  tClr     ,{tGate
tEnd      dat    >1       ,2-tGate

      for 74
          dat 0,0
      rof

tDecoy    equ    (tWipe+1-1196)
tStart    mov    <tDecoy+0,{tDecoy+2
          mov    <tDecoy+3,{tDecoy+5
          mov    <tDecoy+6,{tDecoy+8
          djn.f  tScan+1  ,<tDecoy+10

end    tStart
