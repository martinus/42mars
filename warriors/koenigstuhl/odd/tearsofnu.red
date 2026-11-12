;redcode-94nop
;name TearsOfNu
;author P. Kline
;assert 1==1

step   equ    (5*(10*13+3))
first  equ    (bpit+step*500)

boot   equ    (5005)
sort   equ    (boot+bsort)
fang   equ    (boot+bfang)
pit    equ    (boot+bpit)
incr   equ    (boot+bincr)

vamp   sub.f  incr        ,}pit
       mov    fang        ,<fang
       mov    {pit        ,{fang
       jmz.f  vamp        ,pit
;break
b1     jmp    gs          ,bsort+6

bsort  djn    bpit        ,#1
bincr  dat    #-1-step     ,#step-1
bfang  djn.a  bsort-first+1 ,*first+1

bpit   spl    #0          ,{0
       spl    {0          ,}0
gate   jmn.a  bpit        ,bpit

gd     dat    gs          ,dz-gate+2
gs     spl    #MAXLENGTH-CURLINE,dz-gate+1
       mov    *gd         ,>gate
       mov    *gd         ,>gate
       mov    *gd         ,>gate
       djn.f  -3          ,}gs
dz     dat    0           ,0

pboot  spl    2           ,bsort+6
       spl    1           ,sort+6
       mov    <pboot      ,<-1
       mov    <pboot      ,<-2
       mov    dz          ,<b1
       mov    dz          ,<b1
airbag jmp    <0          ,vamp+3

       end    pboot
