;redcode-tiny
;name Lapis Impus 3
;author Christian Schmidt
;assert 1
;strategy dwarf + imps
;kill Lapis Impus 2
 
sStep1  equ     149
sStep2  equ     632
sStep3  equ     293
sStep4  equ     151
iAwa    equ     335
 
iStep equ (CORESIZE/3+1)
 
sGo     spl    #sStep1 , >sStep2
sBmb    mov    {sStep3 , {sStep4
        add    -2      , -1
pEnd    djn.f  @0      , {-2
 
        for    4
        dat    0       , 0
        rof
 
dGo     mov    <102, {180
        mov    <85, {313
        mov    <713, {328
        mov    <17, {413
 
wGo     spl    sGo     , {222
        mov    imp     , imp+iAwa
strt:   spl    1       , imp+iAwa+(6*iStep)
        spl    1       , imp+iAwa+(4*iStep)
        spl    2       , imp+iAwa+(2*iStep)
frst:   djn.a  >frst   , #imp+iAwa+(0*iStep)
scnd:   djn.a  @scnd   , #imp+iAwa+(1*iStep)
imp:    mov.i #134     , iStep
 
end dGo
