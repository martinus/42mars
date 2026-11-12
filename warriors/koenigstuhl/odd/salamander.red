;redcode-94m
;name Salamander
;author S.Fernandes
;strategy bomber
;assert CORESIZE==8000

step    equ    1810

loop    mov    j     ,  @ptr
        mov    s     ,  <ptr
ptr     mov    x     ,  {-step-1
gate    sub    #step ,  ptr
x       djn    loop  ,  #799
s       spl    #6    ,  1
clr     mov    wipe  ,  }gate
j       djn.f  clr   ,  }gate
wipe    dat    6     ,  1

