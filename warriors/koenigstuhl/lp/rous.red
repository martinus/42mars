;redcode-lp
;name R.O.U.S.
;author S.Fernandes
;strategy paper
;assert CORESIZE == 8000

         org    loop

pstep   equ    6192
ipos    equ    5033
spos    equ    1319

paper   mov    #22          ,   #7
loop    mov    <paper       ,   {pboot
         mov    >ipos        ,   {spos
         add.f  <0           ,   >0
        jmn    loop         ,   *loop
         spl    @paper       ,   >83
pboot   jmz    pstep        ,   *0

end

