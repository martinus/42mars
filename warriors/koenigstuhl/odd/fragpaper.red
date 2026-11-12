;redcode-lp
;name FragPaper
;author Michal Janeczek
;       CORESIZE == 55440
;       MAXPROCESSES == 8
;assert 1
;strategy paper/stone

p1    add.x #b1+1    , 0
c1    mov   <p1      , <d1
      mov   b1       , }16921
      jmn   c1       , @p1
      spl   @p1      , 2151
d1    jmz   @0       , 23269
b1    dat   >1       , }1

      for   87
      dat   0        , 0
      rof

stone add   2        , 1
      mov   }7960    , -16238*3980
      jmp   -2       , {16238

start mov   stone+2  , {ptrs
      mov   stone+1  , {ptrs
      mov   stone+0  , {ptrs
      spl   p1       , {0
      spl   p2       , {0
ptrs  spl   p1+45399 , 0
      spl   *ptrs    , 0
      spl   *ptrs    , 0
      jmp   *ptrs    , {ptrs

      for   87
      dat   0        , 0
      rof

p2    add.x #b2+1    , 0
c2    mov   <p2      , <d2
      mov   b2       , {22889
      jmn   c2       , @p2
      spl   @p2      , 2151
d2    jmz   @0       , 15481
b2    dat   >1       , }1

      end   start

