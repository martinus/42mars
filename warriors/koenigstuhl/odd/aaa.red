;redcode
;name aaa
;author mj
;assert 1

;supposed to bed spl bomber->coreclear
;ended up as suicidal dat bomber :(

step equ 3455

inc  spl 0       , 0
     add #2*step , ptr
     mov bomb    , @ptr
ptr  mov bomb    , inc+step+3
     jmp -3      , 0
bomb dat #0      , #step
