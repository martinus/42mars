;redcode-94lp
;name through the shadows
;author John Metcalf
;strategy paper
;assert CORESIZE==8000 
;                      && MAXPROCESSES==8

     pstepa equ 1167
     pstepb equ 6656

src: mov   #8,       #8
loop:mov   <src,     {papa
     mov   @src,     {papb
     jmn   loop,     src
papa:spl   pstepa,   {3078
papb:jmz   pstepb,   *0
     dat   <5334,    <2667
     dat   1,        1
     end   loop
