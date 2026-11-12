;redcode
;name Replicant--
;author S.Fernandes
;strategy paper
;assert CORESIZE == 8000

pstep   equ    2189
sstep   equ    1532

paper   mov    #17          ,   9
loop    mov    <paper       ,   <pboot
        mov    bomb         ,   @2+sstep
        add    #sstep       ,   @loop+3
        mov    bomb         ,   @loop+1
        jmn    loop         ,   paper
        spl    @paper       ,   <-2667
pboot   jmz    @0           ,   pstep
bomb    dat    <2667        ,   <5334

        end    loop

