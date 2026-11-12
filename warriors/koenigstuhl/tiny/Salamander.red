;redcode-tiny
;name Salamander
;author S.Fernandes
;strategy bomber
;assert CORESIZE==800
 
step    equ    215
 
loop    mov    j     ,  @ptr
        mov    s     ,  <ptr
ptr     mov    x     ,  {-step
gate    sub    #step ,  ptr
x       djn    loop  ,  #99
s       spl    #6    ,  1
clr     mov    wipe  ,  }gate
j       djn.f  clr   ,  }gate
wipe    dat    6     ,  1
end
