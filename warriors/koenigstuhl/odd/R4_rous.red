;redcode-tiny
;name R.O.U.S.
;author S.Fernandes
;strategy low process paper for CGM round 4
;       CORESIZE == 800
;assert 1

        org    decoy

pstep   equ    238
ipos    equ    619
spos    equ    279

paper   mov    #13          ,   #7
loop    mov    <paper       ,   {pboot
        mov    >ipos        ,   {spos
        add.f  <0           ,   >0
	jmn    loop         ,   *loop
        spl    @paper       ,   >83
pboot   jmz    pstep        ,   *0

        for    4
        dat    0            ,   0
        rof

colour  equ    paper+500

decoy   mov    >colour      ,   <colour+7
        mov    <colour+8    ,   {colour+15
        mov    <colour+16   ,   {colour+23
        mov    <colour+24   ,   {colour+30
        mov    <colour+31   ,   {colour+37
        mov    <colour+38   ,   {colour+45
        mov    <colour+46   ,   {colour+52
        mov    <colour+53   ,   {colour+60
        djn.f  loop         ,   <colour+68

        end


