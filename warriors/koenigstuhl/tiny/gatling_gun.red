;redcode-tiny 
;name Gatling Gun
;author John Metcalf 
;strategy old school oneshot 
;assert CORESIZE==800 

        step  equ 29 
        first equ 124 
        gap   equ 20 
        gap2  equ 11 

scan    sub    inc,        gate 
        mov    dbmb,       @gate 
gate    sne    first+gap,  *first 
        djn.f  scan,       <-264 

inc     spl    #-step,     <-step 
clear   mov    @bptr,      >gate 
        mov    @bptr,      >gate 
        mov    @bptr,      >gate 
bptr    djn.f  clear+1,    {bomb 

        dat    #-10,       bomb-gate 
bomb    spl    #-15,       bomb+1-gate 
dbmb    dat    }gap2,      <267 

        for    4 
        dat    0,0 
        rof 

decoy   mov    >364,       <385 
        mov    {385,       <-395 
        mov    <-395,      <-375 
        djn.f  scan+1,     {-355 

        end    decoy 

