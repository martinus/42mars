;redcode-94x
;name Aoshi D 48
;author Steve Gunnell
;strategy Fast f-scanner twice.
;assert 1

GAP1    equ 17
GAP2    equ 42
GAP3    equ 38
GO      equ bomb+170
IMPNUM  EQU 37981
IM1     EQU 37981
IM2     EQU 12191

top1 dat    #GO   ,GO+IM1
top2 dat    #GO   ,GO+IM2
for GAP1
     dat.f  $0     ,$0
rof
sca1 add.f  in1   ,top1
     jmz.f  sec1  ,@top1
     mov.i  bomb  ,@top1
sec1 jmz.f  sca1  ,*top1
     mov.i  bomb  ,*top1
     jmn.a  sca1  ,top1
for GAP2
     dat.f  $0     ,$0
rof
     nop    0     ,0
sca2 add.f  in2   ,top2
     jmz.f  sec2  ,@top2
     mov.i  bomb  ,@top2
sec2 jmz.f  sca2  ,*top2
     mov.i  bomb  ,*top2
     jmn.a  sca2  ,top2
     spl    #0    ,#0
     mov    cbmb  ,>sca2
tail djn.f  -1    ,>sca2
for GAP3
     dat.f  $0     ,$0
rof
in1  dat    IM1   ,IM1 
in2  dat    IM2   ,IM2 
bomb mov.i #0, 1
cbmb dat    >37981  ,tail-sca2+3
for MAXLENGTH-CURLINE-3
     dat.f  $0     ,$0
rof
start spl sca1
      jmp sca2
end start

