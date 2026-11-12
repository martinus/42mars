;redcode-94x
;name Slave of Hellhound
;assert 1
;author Roy van Rijn

;strategy Made to optimize the scores from Lord Hellhound
;strategy Its a slave so it follows what the Lord tells him

PIN     222

        ldp.a   #22     ,       save   ;Load what we should do
save    slt     #0      ,       #10    ;If state < 10 start small stone
        jmp     tScan                    ;else start scanning!


bStep   equ     3174
bStart  mov     Stone+2 ,       <bBoot
        mov     Stone+1 ,       <bBoot
        mov     Stone   ,       <bBoot  ;This is a small stone
bBoot   jmp     @0      ,       3923    ;Booted to kill the scanners
Stone   mov     {1545   ,       1-bStep ; (From alladins cave)
        sub.x   #bStep  ,       -1      ;This one is launched together with
        jmp.b   -2      ,       }-2     ; a paper (in the Lord)
                                        ;Then the stone dies, and
                                        ;the paper doesn't fear scanners
                                        ;and the Lord gets all the points
                                        ;This strategy should beat most
                                        ;Stones and Scanners
for     40
        dat     0       ,       0
rof


tPtr      dat    110,4106               ;If we get the instruction to scan
tGate     dat    0,0                    ;then we both start scanning
                                        ;50/50 scores with the Lord this way
          dat    0,0

tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #-12     ,tPtr
          sne    *tPtr    ,@tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,@tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#14
tSpl      spl    #0       ,{0
tClr      mov    tEnd     ,>tGate
          djn.f  -1       ,{tGate
tEnd      dat    >1       ,2-tGate
end

