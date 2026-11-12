;redcode
;name R.O.U.S.
;author S.Fernandes
;strategy paper
;assert CORESIZE == 8000

pstep   equ    6192
ipos    equ    5033
spos    equ    1319

paper   mov    #22          ,   7
loop    mov    <paper       ,   <pboot
        mov    <ipos        ,   <spos
        add    -1           ,   -1
        jmn    loop         ,   paper
        spl    @paper       ,   <83
pboot   jmz    @0           ,   pstep

        end    loop

