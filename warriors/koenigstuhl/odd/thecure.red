;redcode-94odd
;name The Cure
;strategy Bit big...but should score well in the benchmark round
;strategy No idea about the round-robin round...
;author Roy van Rijn
;assert 1

p         dat    996,7615
a         dat    2423,6394
for 6
          dat    0,0
rof

w         mov    s        ,<p
          mov    >p       ,>p
          jmn.f  w        ,>p

c         sub.x  a        ,p
          sne.x  *p       ,>p
          sub.x  a        ,@c
          jmn.f  e        ,<p
          jmz.f  c        ,*p
n         mov.x  @c       ,@c
e         slt.b  @c       ,#30
          djn    w        ,@c
          djn    *n       ,#10

s         spl    #0       ,}0
          mov    2        ,>e
          djn.f  -1       ,{e
          dat    >1       ,2-e
end c