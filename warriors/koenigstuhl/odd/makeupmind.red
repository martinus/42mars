;redcode-TinyLP
;name MakeUpMind
;author Roy van Rijn
;strategy Switch between scanner and stone/paper
;assert 1

      mov #7, #7
p1    mov <-1, <4
      mov 4,>4239
      jmn -2, @-3
      spl @-4, }6476
      jmz.b @0,213
      dat >1, <1

dat 0,0
dat 0,0

sStep   equ     4888
s1      mov     {7318,1-sStep
        sub.x   #sStep   ,-1
        jmp     -2       ,}-2

dat 0,0
dat 0,0

mode equ (less-7905)

less:ldp   }mode,    mode
     ldp.ab mode,    @mode
     stp.a @mode,    <mode+1
     jmn   tScan,     @mode+1

sp    spl s1       , <1057
      spl p1       , }2200
      spl 4        , }456
      spl 2        , >2492
      jmp imp      , {5850
      jmp imp+267  , {398
      spl 2        , }6047
      jmp imp+534  , >1430
      jmp imp+801  , <4662

tPtr  dat >84 ,<651

dat 0,0
dat 0,0
dat 0,0
dat 0,0
dat 0,0
imp   mov.i #0     , 267


tWipe     mov    tSpl     ,<tPtr
          mov    >tPtr    ,>tPtr
          jmn.f  tWipe    ,>tPtr

tScan     sub.x  #715 ,tPtr
          sne.x  *tPtr    ,>tPtr
          sub.x  *pScan   ,@tScan
          jmn.f  tSelf    ,<tPtr
          jmz.f  tScan    ,*tPtr
pScan     mov.x  @tScan   ,@tScan
tSelf     slt.b  @tScan   ,#tEnd+4-tPtr
          djn    tWipe    ,@tScan
          djn    *pScan   ,#18

tSpl      spl    #0       ,}0
tClr      mov    tEnd     ,>tSelf
          djn.f  tClr     ,{tSelf
tEnd      dat    >1       ,2-tSelf

end   less
