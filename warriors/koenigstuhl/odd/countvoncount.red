;redcode-94
;name Count von Count
;author S.Fernandes
;strategy vamp with issues
;assert 1
        org    boot

bpos    equ    5000
pitx    equ    (pit+16)
half    equ    CORESIZE/3

loop    mov    @2    ,  @fang
        add.f  #-fang,  fang
        jmz.f  loop  ,  *fang
        mov    f2    ,  *fang
        mov.ba @-2   ,  *fang
        jmz.f  loop  ,  pitx
f2      jmp    clr   ,  <2667

fp      dat    fang+6,  pitx+bpos+3

boot    mov    loop+6,  {vbt
bt      mov    <pit+3,  <fp
        mov    {fp   ,  <vbt
        mov    {fp   ,  <vbt
        mov    {boot ,  {vbt
        mov    {boot ,  {vbt
        djn    bt    ,  #3
vbt     jmp    loop+bpos+7, fang+bpos+6

fang    jmp    pitx-48, 48

x       dat    9     ,  1
clr     spl    #14   ,  half
        mov    @x    ,  }fang
        mov    @x    ,  }fang
        djn.f  clr+1 ,  >clr

pit     spl    #0    ,  {0
        spl    pit   ,  >pit+50
        djn.f  pit   ,  >pit+50
