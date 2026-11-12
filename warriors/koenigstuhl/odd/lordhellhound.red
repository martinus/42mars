;redcode-94x
;name Lord Hellhound
;assert 1
;author Roy van Rijn

;strategy The Lord, with help of its slave,
;strategy tries to win as much as possible!

;PSpace 22: Overall pointer, Lord and Slave use it for choosing
;           their strategies.
;PSpace 23: Scanner pointer, if the scanner ties to much, reset 22

PIN     222

think   ldp.a   #22     ,       save    ;Load the state
        ldp.a   #0      ,       tie     ;Load what we did!
tie     seq     #0      ,       #3      ;If we won, keep doing what we did
        jmp     choose
        add.a   #1      ,       save    ;Else, add #1 to state
save    stp     #0      ,       #22          ;-save it-
choose  slt.ab  save    ,       #12     ;And then choose what to do
        jmp     scanner                 ;The other warrior (slave)
                                        ;will follow our choice

;papercode
nstep1 equ 1319
cstep1 equ 1871
tstep1 equ 1471

pAw1   equ 6000
pAw2   equ 2000

pGo   mov.i  think-1,save
      mov.i  think-1,savenew    ;overwrite the stps, else we get brainwashed!
      mov.i  think-1,savestat
      spl    1,    <pGo+1169
      spl    1,    <pGo+1217
      spl    1,    <pGo+1482

      mov    {cp,    {pBo1      ;Normal anti-scanner/stone paper (from Revenge)
pBo1  spl    pEnd+pAw1,{2093

      mov    {pEnd,    {pBo2
pBo2  jmp    pEnd+pAw2,{2093

cp    spl    @pEnd,  <tstep1
      mov.i  }cp,    >cp
nothA spl    @nothA, <cstep1
      mov.i  }nothA, >nothA
nothB spl    @nothB, <nstep1
      mov.i  }nothB, >nothB
      mov.i  #1,     <1
cc    djn    -2,     <2335
pEnd  dat    0,      0

for     44
        dat     0       ,       0
rof

;switchbackcode
scanner ldp.b   #23     ,       savestat  ;before we start scanning..
check   seq.ab  tie     ,       #1        ;load scancounter and compare
        add     #1      ,       savestat  ;if we tie, add one
                                          ;(too much ties isn't good)
                                          ;(a scanner loses of wins!)
savestat stp    #0      ,       #23       ;and save the scancoutner
killed  slt.a   #12     ,       savestat  ;if we don't have 12+ ties
        jmp     tScan                           ;keep scanning
savenew stp     #0      ,       #22       ;else reset general state
        jmp     pGo                       ;and start the paper

;scannercode

tPtr      dat    110,4106                 ;Scanner, solo...
tGate     dat    0,0
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
end think

